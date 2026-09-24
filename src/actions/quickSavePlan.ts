'use server'

import { createHash } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { visibleStoriesWhere } from '@/lib/stories'
import { revalidatePath } from 'next/cache'

export async function savePlaceToNewPlan(input: { itemId?: string; storyId?: string; clientId: string }): Promise<{ trip?: { id: string; title: string }; error?: string }> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to save a place.' }
  const sourceId = input?.storyId || input?.itemId
  if (!sourceId || typeof sourceId !== 'string' || sourceId.length > 200 || (!!input.itemId === !!input.storyId) || typeof input.clientId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.clientId)) return { error: 'Please reopen the trip picker and try again.' }
  const id = `quick-plan-${createHash('sha256').update(JSON.stringify([userId, input.storyId ? 'story' : 'place', sourceId, input.clientId])).digest('hex')}`
  try {
    const previous = await prisma.itinerary.findFirst({ where: { id, userId }, select: { id: true, title: true } })
    if (previous) return { trip: previous }
    const place = input.storyId ? null : await prisma.destItem.findFirst({ where: { id: sourceId, destination: { itinerary: { visibility: 'public' } } }, include: { destination: true } })
    const story = input.storyId ? await prisma.story.findFirst({ where: { id: sourceId, ...visibleStoriesWhere(userId) } }) : null
    if (!place && !story) return { error: 'This place is no longer available to save.' }
    const destination = place?.destination.name ?? story!.destination
    const country = place?.destination.country ?? story?.country ?? null
    const title = destination && destination !== 'Destination to decide' ? `Trip to ${destination}`.slice(0, 160) : 'My new trip'
    // Create the private plan and its first place together, so failed saves leave no empty trips.
    const trip = await prisma.itinerary.create({ data: {
      id, userId, title, isPlan: true, visibility: 'draft', datesFlexible: true,
      startDate: new Date('2000-01-01T00:00:00Z'), endDate: new Date('2000-01-01T00:00:00Z'),
      destinations: { create: { name: destination || 'Destination to decide', country, order: 0, items: { create: {
        name: place?.name ?? story!.placeName, type: place?.type ?? story!.type,
        placeId: place?.placeId ?? story?.placeId ?? null, lat: place?.lat ?? story?.lat ?? null, lng: place?.lng ?? story?.lng ?? null,
        address: place?.address ?? null, link: place?.link ?? null, order: 0, groupIndex: 0,
        dayIndex: null, planningStatus: 'considering',
      } } } },
    }, select: { id: true, title: true } })
    for (const path of ['/plan', `/plan/${id}`, `/user/${userId}`, '/trips']) revalidatePath(path)
    return { trip }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      try {
        const trip = await prisma.itinerary.findFirst({ where: { id, userId }, select: { id: true, title: true } })
        if (trip) return { trip }
      } catch { /* Retryable error below. */ }
    }
    return { error: 'Could not save this place. Please try again.' }
  }
}
