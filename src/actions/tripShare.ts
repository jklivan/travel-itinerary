'use server'

import { randomBytes } from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/tripAccess'

// Send a trip (the paper airplane): its address to send by Messages, WhatsApp or anything else. A posted trip's own page;
// a private one gets a view-only link (one per trip, made the first time), so whoever opens it can see the trip but
// not change it. Stored as a TripMember with no person and status "viewer", which can't be used to join the trip.
export async function tripShareLink(tripId: string): Promise<{ error?: string; path?: string; title?: string }> {
  const userId = (await auth())?.user?.id
  if (typeof tripId !== 'string') return { error: 'This trip is unavailable.' }
  const trip = await prisma.itinerary.findUnique({ where: { id: tripId }, select: { id: true, title: true, visibility: true } })
  if (!trip) return { error: 'This trip is unavailable.' }
  if (trip.visibility !== 'draft') return { path: `/itinerary/${trip.id}`, title: trip.title }
  if (!userId || !await prisma.itinerary.findFirst({ where: { id: tripId, ...canEdit(userId) }, select: { id: true } })) return { error: 'This trip is unavailable.' }
  const existing = await prisma.tripMember.findFirst({ where: { itineraryId: tripId, userId: null, status: 'viewer', token: { not: null } }, select: { token: true } })
  const token = existing?.token ?? (await prisma.tripMember.create({ data: { itineraryId: tripId, invitedById: userId, status: 'viewer', token: randomBytes(12).toString('base64url') }, select: { token: true } })).token
  return { path: `/itinerary/${trip.id}?v=${token}`, title: trip.title }
}
