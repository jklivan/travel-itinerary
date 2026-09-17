'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { getRecommendation } from '@/lib/placeRecommendation'

export async function placePeople(placeId: string, name = '', location = '') {
  const userId = (await auth())?.user?.id
  if (!userId) return { people: [], error: 'Sign in to see friends’ recommendations.' }
  if (typeof placeId !== 'string' || placeId.length > 512) return { people: [], error: 'Choose a place from the suggestions.' }
  if (typeof name !== 'string' || name.length > 240 || typeof location !== 'string' || location.length > 1000) return { people: [], error: 'Please select the place again.' }
  const areas = [...new Set(location.split(',').map(part => part.trim()).filter(Boolean))]
  if (!placeId && (!name.trim() || !areas.length)) return { people: [], error: 'Choose a place and destination to see recommendations.' }
  const matches: Prisma.DestItemWhereInput[] = placeId ? [{ placeId }] : []
  if (name.trim() && areas.length) matches.push({ AND: [...(placeId ? [{ OR: [{ placeId: null }, { placeId: '' }] }] : []), { name: { equals: name.trim(), mode: 'insensitive' } }, { destination: { OR: (placeId ? areas : [...new Set([location.trim(), areas[0]])]).map(area => ({ name: { equals: area, mode: 'insensitive' as const } })) } }] })
  try {
    const follows = await prisma.follow.findMany({ where: { followerId: userId, status: 'accepted' }, select: { followingId: true } })
    const friendIds = follows.map(follow => follow.followingId)
    const rows = await prisma.destItem.findMany({
      where: { OR: matches, destination: { itinerary: { visibility: 'public', userId: { not: userId }, user: { OR: [{ isPrivate: false }, { id: { in: friendIds } }] } } } },
      select: { rating: true, tags: true, notes: true, planningStatus: true, destination: { select: { itinerary: { select: { id: true, title: true, isPlan: true, datesFlexible: true, postType: true, endDate: true, createdAt: true, user: { select: { id: true, name: true } } } } } } },
      orderBy: { destination: { itinerary: { createdAt: 'desc' } } },
    })
    const seen = new Set<string>()
    const now = new Date()
    const people = rows.flatMap(row => {
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
