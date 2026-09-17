'use server'

import { createHash } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

type CopyInput = { sourceId: string; clientId: string; title: string; keepDays: boolean; keepNotes: boolean }

export async function copyTripToPlan(input: CopyInput): Promise<{ id?: string; error?: string }> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to copy a trip.' }
  if (!input || typeof input.sourceId !== 'string' || !input.sourceId || input.sourceId.length > 100 || typeof input.clientId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.clientId) || typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 160 || typeof input.keepDays !== 'boolean' || typeof input.keepNotes !== 'boolean') return { error: 'Enter a trip name and try again.' }
  // A lost response or double tap must not create another copy.
  const id = `trip-copy-${createHash('sha256').update(JSON.stringify([userId, input.sourceId, input.clientId])).digest('hex')}`
  try {
    const existing = await prisma.itinerary.findUnique({ where: { id }, select: { userId: true } })
    if (existing) return existing.userId === userId ? { id } : { error: 'Could not copy this trip.' }
    const source = await prisma.itinerary.findFirst({
      where: { id: input.sourceId, OR: [{ userId }, { visibility: 'public' }] },
      include: { destinations: { orderBy: { order: 'asc' }, include: { items: { orderBy: { order: 'asc' } } } } },
    })
    if (!source) return { error: 'This itinerary is no longer available to copy.' }
    const keepNotes = source.userId === userId && input.keepNotes
    // Nested creation is atomic: every destination and place receives a new ID.
    await prisma.itinerary.create({ data: {
      id, userId, title: input.title.trim(), visibility: 'draft', isPlan: true, postType: 'itinerary',
      datesFlexible: true, startDate: new Date('2000-01-01T00:00:00Z'), endDate: new Date('2000-01-01T00:00:00Z'),
      audience: source.audience,
      notes: keepNotes ? source.notes : null,
      destinations: { create: source.destinations.map(destination => {
        const zeroBased = destination.items.some(item => item.type !== 'hotel' && item.dayIndex === 0)
        return {
          name: destination.name, country: destination.country, lat: destination.lat, lng: destination.lng, order: destination.order,
          notes: keepNotes ? destination.notes : null,
          items: { create: destination.items.map(item => ({
            name: item.name, type: item.type, mealType: item.mealType, address: item.address, link: item.link,
            placeId: item.placeId, lat: item.lat, lng: item.lng, order: item.order, groupIndex: item.groupIndex,
            dayIndex: input.keepDays && item.dayIndex !== null ? item.dayIndex + (zeroBased ? 1 : 0) : null,
            planningStatus: 'considering', notes: keepNotes ? item.notes : null,
            // Ratings, photos, stamps and booking/visit history belong to the original visit.
          })) },
        }
      }) },
    } })
    for (const path of ['/plan', `/plan/${id}`, `/user/${userId}`]) revalidatePath(path)
    return { id }
  } catch (error) {
    // Concurrent retries can race the preflight read; the unique ID still deduplicates them.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      try {
        const existing = await prisma.itinerary.findUnique({ where: { id }, select: { userId: true } })
        if (existing?.userId === userId) return { id }
      } catch { /* Return the retryable error below. */ }
    }
    return { error: 'Could not copy this trip. Your choices are still here; please try again.' }
  }
}
