import { prisma } from '@/lib/prisma'
import { hiddenAccountsFor } from '@/lib/hiddenAccounts'

export type ContextItem = { id: string; name: string; type: string; placeId: string | null; lat: number | null; lng: number | null; destination: string; country: string | null; tripId: string; owner: string; mine: boolean }

const tripSelect = {
  id: true, title: true, postType: true, audience: true, tripRating: true, visibility: true, datesFlexible: true, startDate: true, budget: true, tags: true,
  user: { select: { name: true } },
  destinations: { orderBy: { order: 'asc' as const }, select: { name: true, country: true, items: { orderBy: { order: 'asc' as const }, select: {
    id: true, name: true, type: true, rating: true, notes: true, tags: true, placeId: true, lat: true, lng: true, planningStatus: true,
  } } } },
}
const typeLabel: Record<string, string> = { hotel: 'Stay', food_drink: 'Food & drink', activity: 'Activity', transport: 'Transport' }

function clip(value: string | null, max: number) {
  if (!value) return ''
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

// Builds a compact, deterministic text dump of the viewer's trips and their friends' published trips.
// `excludeTripId` keeps the trip being planned out of the cached context; its live state is sent per turn instead.
export async function loadPlanningContext(userId: string, excludeTripId?: string) {
  const [mine, friends, saved, account, likes] = await Promise.all([
    prisma.itinerary.findMany({ where: { userId, ...(excludeTripId ? { id: { not: excludeTripId } } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 60, select: tripSelect }),
    prisma.itinerary.findMany({ where: { visibility: 'public', userId: { notIn: [userId, ...hiddenAccountsFor(userId)] }, user: { followers: { some: { followerId: userId, status: 'accepted' } } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200, select: tripSelect }),
    // Trips you saved from anyone (Saved), for "Plan from your saved places".
    prisma.itinerary.findMany({ where: { visibility: 'public', userId: { notIn: [userId, ...hiddenAccountsFor(userId)] }, bucketedBy: { some: { userId } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 40, select: tripSelect }),
    // Sign-up's "your best vacation" answers.
    prisma.user.findUnique({ where: { id: userId }, select: { bestVacation: true } }),
    // Trips they've hearted, for the destinations they like.
    prisma.tripLike.findMany({ where: { userId, itinerary: { visibility: { not: 'draft' }, userId: { notIn: [userId, ...hiddenAccountsFor(userId)] } } }, orderBy: { createdAt: 'desc' }, take: 40,
      select: { itinerary: { select: { title: true, user: { select: { name: true } }, destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true } } } } } }),
  ])
  const friendIds = new Set(friends.map(trip => trip.id))
  const savedOnly = saved.filter(trip => !friendIds.has(trip.id))
  const savedIds = new Set(saved.map(trip => trip.id))
  const items = new Map<string, ContextItem>()
  const sections = [...mine.map(trip => ({ trip, isMine: true })), ...friends.map(trip => ({ trip, isMine: false })), ...savedOnly.map(trip => ({ trip, isMine: false }))].map(({ trip, isMine }) => {
    const header = [`## ${isMine ? 'Your trip' : `${trip.user.name}'s trip`}${savedIds.has(trip.id) ? ' (you saved it)' : ''}: "${trip.title}"`,
      trip.visibility === 'draft' ? 'draft plan' : trip.postType,
      trip.datesFlexible ? '' : trip.startDate.toISOString().slice(0, 7),
      trip.tripRating ? `trip rated ${trip.tripRating}/5` : '', `for ${trip.audience}`,
      trip.budget ? `budget ${'$'.repeat(trip.budget)}` : '', trip.tags.length ? `tags: ${trip.tags.slice(0, 6).join(', ')}` : ''].filter(Boolean).join(' · ')
    const body = trip.destinations.map(destination => {
      const lines = destination.items.map(item => {
        items.set(item.id, { id: item.id, name: item.name, type: item.type, placeId: item.placeId, lat: item.lat, lng: item.lng, destination: destination.name, country: destination.country, tripId: trip.id, owner: isMine ? 'you' : trip.user.name, mine: isMine })
        return `- [${item.id}] ${typeLabel[item.type] ?? item.type}: ${item.name}${item.rating ? ` · ★${item.rating}` : ''}${item.tags.length ? ` · ${item.tags.slice(0, 5).join(', ')}` : ''}${item.notes ? ` · "${clip(item.notes, 240)}"` : ''}`
      })
      return `### ${[destination.name, destination.country].filter(Boolean).join(', ')}\n${lines.join('\n') || '(no places yet)'}`
    }).join('\n')
    return `${header}\n${body}`
  })
  // Trips with at least one place say enough about the traveler's taste to skip the budget/type/activity questions.
  const hasOwnTrips = mine.some(trip => trip.destinations.some(destination => destination.items.length > 0))
  // Their best vacation from sign-up: the main clue to their taste while they have no trips of their own, then
  // listed like one of their trips (no more weight than the others).
  const best = account?.bestVacation as { destination?: string; travelers?: string; hotel?: { name?: string } | null; tags?: string[] } | null
  if (best?.destination) {
    const details = [best.travelers && `with: ${best.travelers}`, best.tags?.length && `they did: ${best.tags.join(', ')}`, best.hotel?.name && `stayed at ${best.hotel.name}`].filter(Boolean).join(' · ')
    sections[hasOwnTrips ? 'push' : 'unshift'](hasOwnTrips
      ? `## Your trip: their best vacation (from sign-up): "${best.destination}"${details ? ` · ${details}` : ''}`
      : `## Their best vacation (told us at sign-up; they have no trips logged yet, so this is the main clue to their taste: use it for the kinds of places and things they enjoy): "${best.destination}"${details ? ` · ${details}` : ''}`)
  }
  // What they like, up front so it's weighed: places they rated highly or poorly on their own trips, and the
  // destinations of trips they've liked.
  const rated = mine.flatMap(trip => trip.destinations.flatMap(destination => destination.items.filter(item => item.rating)
    .map(item => ({ rating: item.rating!, line: `${item.name} (${typeLabel[item.type] ?? item.type}), ${[destination.name, destination.country].filter(Boolean).join(', ')} ★${item.rating}` }))))
  const loved = rated.filter(item => item.rating >= 4).slice(0, 40).map(item => item.line)
  const disliked = rated.filter(item => item.rating <= 2).slice(0, 20).map(item => item.line)
  const likedPlaces = [...new Map(likes.flatMap(like => like.itinerary.destinations.map(destination => {
    const place = [destination.name, destination.country].filter(Boolean).join(', ')
    return [place.toLowerCase(), `${place} (liked ${like.itinerary.user.name}'s trip "${like.itinerary.title}")`] as const
  }))).values()].slice(0, 30)
  const tastes = [
    loved.length && `Places they loved (rated 4-5 stars on their own trips; weigh these heavily and suggest similar places):\n${loved.map(line => `- ${line}`).join('\n')}`,
    disliked.length && `Places they didn't like (rated 1-2 stars; steer away from similar places):\n${disliked.map(line => `- ${line}`).join('\n')}`,
    likedPlaces.length && `Destinations they've liked on Postcard (from trips they hearted):\n${likedPlaces.map(line => `- ${line}`).join('\n')}`,
  ].filter(Boolean)
  if (tastes.length) sections.unshift(`## What this traveler likes\n${tastes.join('\n\n')}`)
  const text = sections.length ? sections.join('\n\n') : '(No trips yet from you or your friends.)'
  return { text, items, friendCount: new Set(friends.map(trip => trip.user.name)).size, hasOwnTrips }
}
