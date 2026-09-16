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
    include: { user: { select: { id: true, name: true } }, sourceItinerary: { select: { id: true, visibility: true } } },
  })
  // Only this explicit snapshot is sent to viewers. Private trip IDs, titles,
  // notes, photos and other places are never serialized with a story.
  return rows.map(row => ({ id: row.id, authorId: row.user.id, authorName: row.user.name, placeName: row.placeName,
    destination: [row.destination, row.country].filter(Boolean).join(', '), type: row.type, photoUrl: row.photoUrl, caption: row.caption,
    createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
    tripHref: row.sourceItinerary?.visibility === 'public' ? `/itinerary/${row.sourceItinerary.id}` : null,
  }))
}

export async function storySources() {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to post a story.', trips: [], isPrivate: false }
  const [user, trips] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPrivate: true } }),
    prisma.itinerary.findMany({ where: { userId, destinations: { some: { items: { some: {} } } } }, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, photos: { where: { isStock: false }, select: { url: true } }, destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: { id: true, name: true, type: true, photoUrl: true, photoUrls: true } } } } },
    }),
  ])
  return { isPrivate: user?.isPrivate ?? true, trips: trips.map(trip => ({ id: trip.id, title: trip.title, photos: trip.photos.map(photo => photo.url),
    places: trip.destinations.flatMap(destination => destination.items.map(item => ({ id: item.id, name: item.name, type: item.type,
      destination: [destination.name, destination.country].filter(Boolean).join(', '), photos: eventPhotos(item.photoUrls, item.photoUrl),
    }))),
  })) }
}

export async function postStory(input: { id: string; itemId: string; photoUrl: string; caption: string }): Promise<Result> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to post a story.' }
  if (!input || typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id)
    || typeof input.itemId !== 'string' || !input.itemId || input.itemId.length > 200
    || typeof input.caption !== 'string' || input.caption.length > 500
    || typeof input.photoUrl !== 'string' || input.photoUrl.length > 4096 || !/^(https:\/\/|\/(?!\/))/.test(input.photoUrl)) return { error: 'Choose a photo and a place, and keep your caption under 500 characters.' }
  try {
    const previous = await prisma.story.findUnique({ where: { id: input.id }, select: { userId: true, expiresAt: true } })
    if (previous) return previous.userId === userId && previous.expiresAt > new Date() ? { success: true } : { error: 'This story is no longer available. Close the composer and start a new story.' }
    const item = await prisma.destItem.findFirst({ where: { id: input.itemId, destination: { itinerary: { userId } } }, include: { destination: true } })
    if (!item) return { error: 'Choose a place from one of your own trips.' }
    const now = new Date()
    await prisma.story.create({ data: {
      id: input.id, userId, sourceItineraryId: item.destination.itineraryId, sourceItemId: item.id,
      placeName: item.name, destination: item.destination.name, country: item.destination.country, type: item.type,
      placeId: item.placeId, lat: item.lat, lng: item.lng, photoUrl: input.photoUrl, caption: input.caption.trim(),
      createdAt: now, expiresAt: new Date(now.getTime() + STORY_LIFETIME_MS),
    } })
    revalidatePath('/')
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
