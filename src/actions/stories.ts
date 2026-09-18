'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { eventPhotos } from '@/lib/eventPhotos'
import { STORY_LIFETIME_MS, visibleStoriesWhere, type StoryCard } from '@/lib/stories'

type Result = { error?: string; success?: boolean }
export async function activeStories(following = false): Promise<StoryCard[]> {
  const userId = (await auth())?.user?.id ?? null
  const rows = await prisma.story.findMany({ where: visibleStoriesWhere(userId, following), orderBy: { createdAt: 'desc' }, take: 200,
    include: { user: { select: { id: true, name: true } }, sourceItinerary: { select: { id: true, visibility: true, isPlan: true } } },
  })
  // Only a public trip link or the owner's private plan link is sent to viewers.
  // Trip notes, titles, photos and other places are never serialized with a story.
  return rows.map(row => ({ id: row.id, authorId: row.user.id, authorName: row.user.name, placeName: row.placeName,
    destination: [row.destination, row.country].filter(Boolean).join(', '), hasTrip: !!row.sourceItinerary, type: row.type, photoUrl: row.photoUrl, caption: row.caption,
    createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
    tripHref: row.sourceItinerary?.visibility === 'public' ? `/itinerary/${row.sourceItinerary.id}` : row.user.id === userId && row.sourceItinerary?.isPlan ? `/plan/${row.sourceItinerary.id}` : null,
  }))
}

export async function storySources() {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to post a story.', trips: [], isPrivate: false }
  const [user, trips] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPrivate: true } }),
    prisma.itinerary.findMany({ where: { userId, OR: [{ isPlan: true }, { destinations: { some: { items: { some: {} } } } }] }, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, isPlan: true, photos: { where: { isStock: false }, select: { url: true } }, destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: { id: true, name: true, type: true, photoUrl: true, photoUrls: true } } } } },
    }),
  ])
  return { isPrivate: user?.isPrivate ?? true, trips: trips.map(trip => ({ id: trip.id, title: trip.title, isPlan: trip.isPlan, photos: trip.photos.map(photo => photo.url),
    places: trip.destinations.flatMap(destination => destination.items.map(item => ({ id: item.id, name: item.name, type: item.type,
      destination: [destination.name, destination.country].filter(Boolean).join(', '), photos: eventPhotos(item.photoUrls, item.photoUrl),
    }))),
  })) }
}

export async function postStory(input: { id: string; itemId?: string; placeName?: string; destination?: string; country?: string; type?: string; placeId?: string; tripId?: string; newPlanId?: string; newPlanTitle?: string; photoUrl: string; caption: string }): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to post a story.' }
  if (!input || typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id)
    || typeof input.caption !== 'string' || input.caption.length > 500
    || typeof input.photoUrl !== 'string' || input.photoUrl.length > 4096 || !/^(https:\/\/|\/(?!\/))/.test(input.photoUrl)) return { error: 'Choose a photo and a place, and keep your caption under 500 characters.' }
  const standalone = !input.itemId
  const allowedTypes = ['hotel', 'food_drink', 'activity', 'transport']
  if (input.itemId && (typeof input.itemId !== 'string' || input.itemId.length > 200)) return { error: 'Choose a place, and keep your caption under 500 characters.' }
  if (standalone && (typeof input.placeName !== 'string' || !input.placeName.trim() || input.placeName.trim().length > 240
    || typeof input.destination !== 'string' || !input.destination.trim() || input.destination.trim().length > 240
    || typeof input.type !== 'string' || !allowedTypes.includes(input.type)
    || (input.country !== undefined && (typeof input.country !== 'string' || input.country.length > 120))
    || (input.placeId !== undefined && (typeof input.placeId !== 'string' || input.placeId.length > 200))
    || (input.tripId !== undefined && (typeof input.tripId !== 'string' || !input.tripId || input.tripId.length > 200))
    || (input.newPlanId !== undefined && (typeof input.newPlanId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.newPlanId)))
    || (input.newPlanTitle !== undefined && (typeof input.newPlanTitle !== 'string' || !input.newPlanTitle.trim() || input.newPlanTitle.trim().length > 160))
    || (!!input.tripId === !!input.newPlanId) || (!!input.newPlanId !== !!input.newPlanTitle))) return { error: 'Choose an itinerary and add an activity name, destination, and category.' }
  try {
    const previous = await prisma.story.findUnique({ where: { id: input.id }, select: { userId: true, expiresAt: true } })
    if (previous) return previous.userId === userId && previous.expiresAt > new Date() ? { success: true } : { error: 'This story is no longer available. Close the composer and start a new story.' }
    const tripId = await prisma.$transaction(async tx => {
      let storyPlace: { name: string; destination: string; country: string | null; type: string; placeId: string | null; lat: number | null; lng: number | null; tripId: string | null; itemId: string | null }
      if (input.itemId) {
        const owned = { id: input.itemId, destination: { itinerary: { userId } } }
        const item = await tx.destItem.findFirst({ where: owned, include: { destination: true } })
        if (!item) throw new Error('Place is not owned by this account')
        const photos = eventPhotos(item.photoUrls, item.photoUrl)
        if (!photos.includes(input.photoUrl)) {
          photos.push(input.photoUrl)
          // A concurrent photo edit must never be overwritten by this story.
          const updated = await tx.destItem.updateMany({
            where: { ...owned, photoUrls: { equals: item.photoUrls }, photoUrl: item.photoUrl },
            data: { photoUrls: photos, photoUrl: item.photoUrl || photos[0] },
          })
          if (updated.count !== 1) throw new Error('Photos changed while posting; retry')
        }
        storyPlace = { name: item.name, destination: item.destination.name, country: item.destination.country, type: item.type, placeId: item.placeId, lat: item.lat, lng: item.lng, tripId: item.destination.itineraryId, itemId: item.id }
      } else {
        let itineraryId: string
        if (input.newPlanId) {
          await tx.itinerary.create({ data: {
            id: input.newPlanId, userId, title: input.newPlanTitle!.trim(), isPlan: true, visibility: 'draft', datesFlexible: true,
            startDate: new Date('2000-01-01T00:00:00Z'), endDate: new Date('2000-01-01T00:00:00Z'),
          } })
          itineraryId = input.newPlanId
        } else {
          const existingTrip = await tx.itinerary.findFirst({ where: { id: input.tripId, userId }, select: { id: true } })
          if (!existingTrip) throw new Error('Itinerary is not owned by this account')
          itineraryId = existingTrip.id
        }
        let destination = await tx.destination.findFirst({ where: { itineraryId, name: { equals: input.destination!.trim(), mode: 'insensitive' }, country: input.country?.trim() || null } })
        if (!destination) destination = await tx.destination.create({ data: {
          itineraryId, name: input.destination!.trim(), country: input.country?.trim() || null,
          order: await tx.destination.count({ where: { itineraryId } }),
        } })
        const last = await tx.destItem.aggregate({ where: { destinationId: destination.id }, _max: { order: true, groupIndex: true } })
        const item = await tx.destItem.create({ data: {
          destinationId: destination.id, name: input.placeName!.trim(), type: input.type!, placeId: input.placeId?.trim() || null,
          photoUrl: input.photoUrl, photoUrls: [input.photoUrl], order: (last._max.order ?? -1) + 1,
          groupIndex: input.type === 'hotel' ? (last._max.groupIndex ?? -1) + 1 : 0,
        } })
        storyPlace = { name: item.name, destination: destination.name, country: destination.country, type: item.type, placeId: item.placeId, lat: item.lat, lng: item.lng, tripId: itineraryId, itemId: item.id }
      }
      const now = new Date()
      await tx.story.create({ data: {
        id: input.id, userId, sourceItineraryId: storyPlace.tripId, sourceItemId: storyPlace.itemId,
        placeName: storyPlace.name, destination: storyPlace.destination, country: storyPlace.country, type: storyPlace.type,
        placeId: storyPlace.placeId, lat: storyPlace.lat, lng: storyPlace.lng, photoUrl: input.photoUrl, caption: input.caption.trim(),
        createdAt: now, expiresAt: new Date(now.getTime() + STORY_LIFETIME_MS),
      } })
      return storyPlace.tripId
    })
    for (const path of ['/', '/explore', '/plan', ...(tripId ? [`/plan/${tripId}`, `/itinerary/${tripId}`] : []), `/user/${userId}`]) revalidatePath(path)
    return { success: true }
  } catch { return { error: 'Could not post your story. Your photo and caption are still here; please try again.' } }
}

export async function deleteStory(id: string): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try {
    const result = await prisma.story.deleteMany({ where: { id, userId } })
    if (!result.count) return { error: 'This story is no longer available.' }
    revalidatePath('/')
    return { success: true }
  } catch { return { error: 'Could not remove your story. Please try again.' } }
}

export async function copyStoryToPlan(storyId: string, planId: string, clientId: string): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (!/^[a-f0-9-]{36}$/.test(clientId)) return { error: 'Please reopen the trip picker and try again.' }
  try {
    const result = await prisma.$transaction(async tx => {
      const plan = await tx.itinerary.findFirst({ where: { id: planId, userId, isPlan: true }, select: { id: true } })
      const story = await tx.story.findFirst({ where: { id: storyId, ...visibleStoriesWhere(userId) } })
      if (!plan || !story) return { error: 'This story has expired or is unavailable, or the plan belongs to another account.' }
      const existing = await tx.destItem.findUnique({ where: { id: clientId }, select: { destination: { select: { itineraryId: true } } } })
      if (existing) return existing.destination.itineraryId === planId ? { success: true } : { error: 'Please reopen the trip picker and try again.' }
      let destination = await tx.destination.findFirst({ where: { itineraryId: planId, name: { equals: story.destination, mode: 'insensitive' } } })
      if (!destination) destination = await tx.destination.create({ data: { itineraryId: planId, name: story.destination, country: story.country, order: await tx.destination.count({ where: { itineraryId: planId } }) } })
      const last = await tx.destItem.aggregate({ where: { destinationId: destination.id }, _max: { order: true, groupIndex: true } })
      await tx.destItem.create({ data: { id: clientId, destinationId: destination.id, name: story.placeName, type: story.type,
        placeId: story.placeId, lat: story.lat, lng: story.lng, order: (last._max.order ?? -1) + 1,
        groupIndex: story.type === 'hotel' ? (last._max.groupIndex ?? -1) + 1 : 0,
      } })
      return { success: true }
    })
    for (const path of ['/', '/plan', `/plan/${planId}`, `/itinerary/${planId}`]) revalidatePath(path)
    return result
  } catch { return { error: 'Could not save this place. Please try again.' } }
}
