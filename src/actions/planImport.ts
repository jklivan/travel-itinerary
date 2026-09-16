'use server'

import { after } from 'next/server'
import { enrichPlaceIds } from '@/lib/enrichPlaceIds'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { ImportedPlace } from '@/lib/planImport'

export async function importIntoPlan(planId: string, requestId: string, places: ImportedPlace[]) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId) || !Array.isArray(places) || !places.length || places.length > 200) return { error: 'Choose between 1 and 200 places to import.' }
  if (places.some(p => !p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 240 || typeof p.destination !== 'string' || !p.destination.trim() || p.destination.length > 160 || typeof p.country !== 'string' || p.country.length > 160 || typeof p.notes !== 'string' || p.notes.length > 8000 || typeof p.mealType !== 'string' || p.mealType.length > 100 || !['hotel', 'food_drink', 'activity'].includes(p.type) || (p.day !== null && (!Number.isInteger(p.day) || p.day < 1 || p.day > 365)) || (p.rating !== null && (!Number.isInteger(p.rating) || p.rating < 1 || p.rating > 5)))) return { error: 'Some imported details are invalid. Please shorten the notes or import fewer places.' }
  try {
    await prisma.$transaction(async tx => {
      const plan = await tx.itinerary.findFirst({ where: { id: planId, userId }, select: { id: true } })
      if (!plan) throw Error('Unavailable')
      // A transaction commits the complete batch; its first item also identifies a retry.
      const previous = await tx.destItem.findUnique({ where: { id: `${requestId}:0` }, select: { destination: { select: { itineraryId: true } } } })
      if (previous) {
        if (previous.destination.itineraryId !== planId) throw Error('Unavailable')
        return
      }
      for (const [index, place] of places.entries()) {
        let destination = await tx.destination.findFirst({ where: { itineraryId: planId, name: { equals: place.destination.trim(), mode: 'insensitive' }, ...(place.country ? { country: { equals: place.country, mode: 'insensitive' } } : {}) } })
        if (!destination) destination = await tx.destination.create({ data: { itineraryId: planId, name: place.destination.trim(), country: place.country || null, order: await tx.destination.count({ where: { itineraryId: planId } }) } })
        const last = await tx.destItem.aggregate({ where: { destinationId: destination.id }, _max: { order: true, groupIndex: true } })
        await tx.destItem.create({ data: { id: `${requestId}:${index}`, destinationId: destination.id, name: place.name.trim(), type: place.type, notes: place.notes || null, rating: place.rating, mealType: place.type === 'food_drink' ? place.mealType || null : null, dayIndex: place.day, order: (last._max.order ?? -1) + 1, groupIndex: place.type === 'hotel' ? (last._max.groupIndex ?? -1) + 1 : 0 } })
      }
    }, { timeout: 60000 })
    after(() => enrichPlaceIds(places.map((_, index) => `${requestId}:${index}`)).catch(() => undefined))
    for (const path of ['/', '/plan', `/plan/${planId}`, `/itinerary/${planId}`]) revalidatePath(path)
    return { success: true }
  } catch { return { error: 'Could not add these places. Your review is still here; please try again.' } }
}
