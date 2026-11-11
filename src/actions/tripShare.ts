'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/tripAccess'
import { viewerToken } from '@/lib/tripViewLink'

// Send a trip (the paper airplane): its address to send by Messages, WhatsApp or anything else. A posted trip's own page;
// a private one gets its view-only link (lib/tripViewLink), so whoever opens it can see the trip but not change it.
export async function tripShareLink(tripId: string): Promise<{ error?: string; path?: string; title?: string }> {
  const userId = (await auth())?.user?.id
  if (typeof tripId !== 'string') return { error: 'This trip is unavailable.' }
  const trip = await prisma.itinerary.findUnique({ where: { id: tripId }, select: { id: true, title: true, visibility: true } })
  if (!trip) return { error: 'This trip is unavailable.' }
  if (trip.visibility !== 'draft') return { path: `/itinerary/${trip.id}`, title: trip.title }
  if (!userId || !await prisma.itinerary.findFirst({ where: { id: tripId, ...canEdit(userId) }, select: { id: true } })) return { error: 'This trip is unavailable.' }
  const token = await viewerToken(tripId, userId)
  return { path: `/itinerary/${trip.id}?v=${token}`, title: trip.title }
}
