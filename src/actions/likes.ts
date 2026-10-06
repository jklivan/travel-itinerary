'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// The feed's likes sheet: everyone who liked (saved) a trip, newest first, and whether you follow each of them.
// Anyone who can open the trip can see this: any posted trip, or your own draft.
export async function loadLikers(itineraryId: string) {
  const userId = (await auth())?.user?.id
  if (typeof itineraryId !== 'string' || itineraryId.length > 200) return { error: 'Not found.', likers: [], userId }
  const itinerary = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { visibility: true, userId: true } })
  if (!itinerary || (itinerary.visibility === 'draft' && itinerary.userId !== userId)) return { error: 'Not found.', likers: [], userId }
  const likes = await prisma.bucketListItem.findMany({ where: { itineraryId }, orderBy: { createdAt: 'desc' }, take: 500, select: { user: { select: { id: true, name: true, image: true } } } })
  const following = userId ? new Set((await prisma.follow.findMany({ where: { followerId: userId, status: 'accepted', followingId: { in: likes.map(like => like.user.id) } }, select: { followingId: true } })).map(row => row.followingId)) : new Set<string>()
  return { userId, likers: likes.map(({ user }) => ({ ...user, following: following.has(user.id) })) }
}

// A trip's destination line "Joshua also visited · Saved by 3 travelers": who those people are.
// visited: people you follow with a shared trip to the same destination (not this trip).
// saved: everyone who saved a shared trip that includes this destination.
export async function destinationPeople(itineraryId: string, destination: string) {
  const userId = (await auth())?.user?.id
  if (typeof itineraryId !== 'string' || typeof destination !== 'string' || !destination.trim() || destination.length > 240) return { error: 'Not found.', visited: [], saved: [] }
  const trip = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { visibility: true, userId: true } })
  if (!trip || (trip.visibility === 'draft' && trip.userId !== userId)) return { error: 'Not found.', visited: [], saved: [] }
  const sameDestination = { destinations: { some: { name: { equals: destination.trim(), mode: 'insensitive' as const } } }, visibility: { not: 'draft' } }
  const following = userId ? (await prisma.follow.findMany({ where: { followerId: userId, status: 'accepted' }, select: { followingId: true } })).map(row => row.followingId) : []
  const [visitedTrips, saves] = await Promise.all([
    following.length ? prisma.itinerary.findMany({ where: { ...sameDestination, id: { not: itineraryId }, userId: { in: following } }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, title: true, user: { select: { id: true, name: true, image: true } } } }) : Promise.resolve([]),
    prisma.bucketListItem.findMany({ where: { itinerary: sameDestination }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { user: { select: { id: true, name: true, image: true } }, itinerary: { select: { id: true, title: true } } } }),
  ])
  const person = (user: { id: string; name: string; image: string | null }, tripId: string, tripTitle: string) => ({ id: user.id, name: user.name, image: user.image, tripId, tripTitle })
  const seen = new Set<string>()
  return {
    visited: visitedTrips.filter(t => !seen.has(t.user.id) && seen.add(t.user.id)).map(t => person(t.user, t.id, t.title)),
    saved: (() => { const once = new Set<string>(); return saves.filter(s => !once.has(s.user.id) && once.add(s.user.id)).map(s => person(s.user, s.itinerary.id, s.itinerary.title)) })(),
  }
}
