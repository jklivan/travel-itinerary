import { prisma } from '@/lib/prisma'

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
  const [mine, friends] = await Promise.all([
    prisma.itinerary.findMany({ where: { userId, ...(excludeTripId ? { id: { not: excludeTripId } } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 60, select: tripSelect }),
    prisma.itinerary.findMany({ where: { visibility: 'public', userId: { not: userId }, user: { followers: { some: { followerId: userId, status: 'accepted' } } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200, select: tripSelect }),
  ])
  const items = new Map<string, ContextItem>()
  const sections = [...mine.map(trip => ({ trip, isMine: true })), ...friends.map(trip => ({ trip, isMine: false }))].map(({ trip, isMine }) => {
    const header = [`## ${isMine ? 'Your trip' : `${trip.user.name}'s trip`}: "${trip.title}"`,
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
  const text = sections.length ? sections.join('\n\n') : '(No trips yet from you or your friends.)'
  // Trips with at least one place say enough about the traveler's taste to skip the budget/type/activity questions.
  const hasOwnTrips = mine.some(trip => trip.destinations.some(destination => destination.items.length > 0))
  return { text, items, friendCount: new Set(friends.map(trip => trip.user.name)).size, hasOwnTrips }
}
