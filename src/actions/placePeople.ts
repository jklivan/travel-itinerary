'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { getRecommendation } from '@/lib/placeRecommendation'
import { genericPlaceName, metresApart, sameAddress } from '@/lib/placeMatching'

// itemId: the place being looked at (planner cards), whose map position and address must agree with a same-name match.
export async function placePeople(placeId: string, name = '', location = '', itemId = '') {
  const userId = (await auth())?.user?.id
  if (!userId) return { people: [], error: 'Sign in to see friends’ recommendations.' }
  if (typeof placeId !== 'string' || placeId.length > 512) return { people: [], error: 'Choose a place from the suggestions.' }
  if (typeof name !== 'string' || name.length > 240 || typeof location !== 'string' || location.length > 1000 || typeof itemId !== 'string' || itemId.length > 200) return { people: [], error: 'Please select the place again.' }
  const areas = [...new Set(location.split(',').map(part => part.trim()).filter(Boolean))]
  if (!placeId && (!name.trim() || !areas.length)) return { people: [], error: 'Choose a place and destination to see recommendations.' }
  const matches: Prisma.DestItemWhereInput[] = placeId ? [{ placeId }] : []
  if (name.trim() && areas.length) matches.push({ AND: [...(placeId ? [{ OR: [{ placeId: null }, { placeId: '' }] }] : []), { name: { equals: name.trim(), mode: 'insensitive' } }, { destination: { OR: [...new Set([location.trim(), areas[0]])].map(area => ({ name: { equals: area, mode: 'insensitive' as const } })) } }] })
  try {
    const follows = await prisma.follow.findMany({ where: { followerId: userId, status: 'accepted' }, select: { followingId: true } })
    const friendIds = follows.map(follow => follow.followingId)
    const rows = await prisma.destItem.findMany({
      where: { OR: matches, destination: { itinerary: { visibility: 'public', userId: { not: userId }, user: { OR: [{ isPrivate: false }, { id: { in: friendIds } }] } } } },
      select: { rating: true, tags: true, notes: true, planningStatus: true, placeId: true, lat: true, lng: true, address: true, destination: { select: { itinerary: { select: { id: true, title: true, isPlan: true, datesFlexible: true, postType: true, endDate: true, createdAt: true, user: { select: { id: true, name: true } } } } } } },
      orderBy: { destination: { itinerary: { createdAt: 'desc' } } },
    })
    // This place's own position, to check same-name matches against (only from the signed-in person's own trips).
    const own = itemId ? await prisma.destItem.findFirst({ where: { id: itemId, destination: { itinerary: { userId } } }, select: { lat: true, lng: true, address: true } }) : null
    const generic = genericPlaceName(name)
    const sameSpot = (row: { placeId: string | null; lat: number | null; lng: number | null; address: string | null }) => {
      if (placeId && row.placeId === placeId) return true
      if (own?.lat != null && own.lng != null && row.lat != null && row.lng != null) return metresApart({ lat: own.lat, lng: own.lng }, { lat: row.lat, lng: row.lng }) <= 500
      if (own?.address && row.address) return sameAddress(own.address, row.address)
      // Nothing to compare: a distinctive name in the same city counts; a generic one ("Wine tasting") doesn't.
      return !generic
    }
    const seen = new Set<string>()
    const now = new Date()
    const people = rows.filter(sameSpot).flatMap(row => {
      const trip = row.destination.itinerary
      const recommendation = getRecommendation(row.tags)
      const visited = row.planningStatus === 'visited' || (!trip.isPlan && trip.postType === 'itinerary' && !trip.datesFlexible && trip.endDate <= now)
      // A saved idea or backup is not evidence of a visit or an endorsement.
      if (recommendation === 'option' || (!visited && trip.postType !== 'guide' && row.rating === null && recommendation === 'none') || seen.has(trip.user.id)) return []
      seen.add(trip.user.id)
      return [{ userId: trip.user.id, name: trip.user.name, inGuide: trip.postType === 'guide', isFriend: friendIds.includes(trip.user.id), visited,
        liked: recommendation !== 'avoid' && ((row.rating ?? 0) >= 4 || recommendation === 'must'),
        rating: row.rating, recommendation, notes: row.notes?.slice(0, 1500) ?? '', tripId: trip.id, tripTitle: trip.title }]
    }).sort((a, b) => Number(b.isFriend) - Number(a.isFriend) || Number(b.liked) - Number(a.liked) || a.name.localeCompare(b.name))
    return { people }
  } catch { return { people: [], error: 'Could not load visits and recommendations. Please try again.' } }
}
