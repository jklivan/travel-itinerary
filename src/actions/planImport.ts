'use server'

import { after } from 'next/server'
import { enrichPlaceIds } from '@/lib/enrichPlaceIds'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { locateTripPlaces } from '@/lib/locatePlaces'
import type { ImportedPlace } from '@/lib/planImport'
import { isDate, isTime, tripDay, daysBetween } from '@/lib/placeDates'

// tripDates: the trip's dates, when the trip had none and the import suggested them (earliest to latest date in the documents).
export async function importIntoPlan(planId: string, requestId: string, places: ImportedPlace[], tripDates?: { start: string; end: string } | null) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId) || !Array.isArray(places) || !places.length || places.length > 200) return { error: 'Choose between 1 and 200 places to import.' }
  if (places.some(p => !p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 240 || typeof p.destination !== 'string' || !p.destination.trim() || p.destination.length > 160 || typeof p.country !== 'string' || p.country.length > 160 || typeof p.notes !== 'string' || p.notes.length > 8000 || typeof p.mealType !== 'string' || p.mealType.length > 100 || !['hotel', 'food_drink', 'activity', 'transport'].includes(p.type) || (p.day !== null && (!Number.isInteger(p.day) || p.day < 1 || p.day > 365)) || (p.rating !== null && (!Number.isInteger(p.rating) || p.rating < 1 || p.rating > 5))
    || [p.date, p.endDate].some(value => value !== null && value !== undefined && !isDate(value)) || [p.time, p.endTime].some(value => value !== null && value !== undefined && !isTime(value))
    || (p.near !== undefined && (!p.near || typeof p.near.name !== 'string' || p.near.name.length > 160 || typeof p.near.country !== 'string' || p.near.country.length > 160)))) return { error: 'Some imported details are invalid. Please shorten the notes or import fewer places.' }
  try {
    await prisma.$transaction(async tx => {
      const plan = await tx.itinerary.findFirst({ where: { id: planId, userId }, select: { id: true, datesFlexible: true, startDate: true, endDate: true, durationDays: true } })
      if (!plan) throw Error('Unavailable')
      // The trip's first day, for turning each booking's date into its day of the trip.
      let start = plan.datesFlexible ? null : plan.startDate.toISOString().slice(0, 10)
      // A dated trip with no length yet gets one from its dates, so the planner shows every day.
      if (start && !plan.durationDays) {
        const length = daysBetween(start, plan.endDate.toISOString().slice(0, 10)) + 1
        if (length >= 1 && length <= 365) await tx.itinerary.update({ where: { id: planId }, data: { durationDays: length } })
      }
      if (!start && tripDates && isDate(tripDates.start) && isDate(tripDates.end) && tripDates.end >= tripDates.start && daysBetween(tripDates.start, tripDates.end) < 365) {
        start = tripDates.start
        const length = daysBetween(tripDates.start, tripDates.end) + 1
        await tx.itinerary.update({ where: { id: planId }, data: { startDate: new Date(`${tripDates.start}T00:00:00Z`), endDate: new Date(`${tripDates.end}T00:00:00Z`), datesFlexible: false, durationDays: Math.max(plan.durationDays ?? 0, length) } })
      }
      const dayOf = (place: ImportedPlace) => {
        const day = start && place.date ? tripDay(place.date, start) : place.day
        return day && day >= 1 && day <= 365 ? day : null
      }
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
        await tx.destItem.create({ data: { id: `${requestId}:${index}`, destinationId: destination.id, name: place.name.trim(), type: place.type, notes: place.notes || null, rating: place.rating, mealType: place.type === 'food_drink' ? place.mealType || null : null, dayIndex: dayOf(place),
          date: place.date ? new Date(`${place.date}T00:00:00Z`) : null, time: place.time || null, endDate: place.endDate ? new Date(`${place.endDate}T00:00:00Z`) : null, endTime: place.endTime || null,
          nights: place.type === 'hotel' && place.nights && place.nights >= 1 && place.nights <= 60 ? place.nights : null, order: (last._max.order ?? -1) + 1, groupIndex: place.type === 'hotel' ? (last._max.groupIndex ?? -1) + 1 : 0 } })
      }
    }, { timeout: 60000 })
    after(() => enrichPlaceIds(places.map((_, index) => `${requestId}:${index}`), new Map(places.flatMap((place, index) => place.near?.name.trim() ? [[`${requestId}:${index}`, place.near] as const] : []))).catch(() => undefined))
    after(() => locateTripPlaces(planId).catch(() => {}))
    for (const path of ['/', '/plan', `/plan/${planId}`, `/itinerary/${planId}`]) revalidatePath(path)
    return { success: true }
  } catch { return { error: 'Could not add these places. Your review is still here; please try again.' } }
}
