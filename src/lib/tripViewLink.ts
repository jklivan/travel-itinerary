import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

// A private trip's view-only link (one per trip, made the first time it's needed): whoever opens it can see the trip but
// not change it. Stored as a TripMember with no person and status "viewer", which can't be used to join the trip.
export async function viewerToken(tripId: string, createdBy: string) {
  const existing = await prisma.tripMember.findFirst({ where: { itineraryId: tripId, userId: null, status: 'viewer', token: { not: null } }, select: { token: true } })
  return existing?.token ?? (await prisma.tripMember.create({ data: { itineraryId: tripId, invitedById: createdBy, status: 'viewer', token: randomBytes(12).toString('base64url') }, select: { token: true } })).token!
}

// Where a trip opens for someone else: its page, with the view-only link's code when it's private.
export async function tripPaths(ids: string[]) {
  const trips = ids.length ? await prisma.itinerary.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, visibility: true, members: { where: { userId: null, status: 'viewer', token: { not: null } }, take: 1, select: { token: true } } } }) : []
  return new Map(trips.map(trip => [trip.id, trip.visibility === 'draft' ? (trip.members[0]?.token ? `/itinerary/${trip.id}?v=${trip.members[0].token}` : null) : `/itinerary/${trip.id}`]))
}
