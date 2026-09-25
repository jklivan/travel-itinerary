import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import TestPlanner, { type Turn } from './TestPlanner'
import { cleanPreferences } from '@/lib/travelPreferences'

export const metadata: Metadata = { title: 'Plan with Postcard', robots: { index: false, follow: false } }
export const maxDuration = 300

// Unlinked test page: chat with Claude over your and your friends' trips, add picks to a new plan.
export default async function TestPlanPage({ searchParams }: { searchParams: Promise<{ trip?: string; new?: string }> }) {
  const { trip: tripId, new: fresh } = await searchParams
  const userId = (await auth())?.user?.id
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(tripId ? `/testplan?trip=${tripId}` : '/testplan')}`)
  const chat = fresh ? null : await prisma.planChat.findFirst({ where: { userId, ...(tripId ? { tripId } : {}) }, orderBy: { updatedAt: 'desc' }, select: { id: true, tripId: true, turns: true } })
  // Reopening /testplan resumes the latest conversation, on the trip it built.
  if (!tripId && chat?.tripId) redirect(`/testplan?trip=${chat.tripId}`)
  // Travelers with no trips of their own are asked about budget, destinations and activities first;
  // answers from their last chat pre-fill the next one.
  const [ownTrips, lastSetup] = await Promise.all([
    prisma.itinerary.count({ where: { userId, destinations: { some: { items: { some: {} } } } } }),
    prisma.planChat.findFirst({ where: { userId, turns: { array_contains: [{ role: 'preferences' }] } }, orderBy: { updatedAt: 'desc' }, select: { turns: true } }),
  ])
  const lastPreferences = cleanPreferences((lastSetup?.turns as unknown as { role: string; preferences?: unknown }[] | undefined)?.findLast(turn => turn.role === 'preferences')?.preferences)
  const trip = tripId ? await prisma.itinerary.findFirst({ where: { id: tripId, userId, isPlan: true }, include: { destinations: { orderBy: { order: 'asc' }, include: { items: { orderBy: { order: 'asc' } } } } } }) : null
  return <TestPlanner key={chat?.id ?? `new:${tripId ?? ''}`} hasOwnTrips={ownTrips > 0} lastPreferences={lastPreferences} chat={chat && { id: chat.id, turns: chat.turns as unknown as Turn[] }} trip={trip && { id: trip.id, title: trip.title,
    places: trip.destinations.flatMap(d => d.items.map(item => ({ id: item.id, name: item.name, type: item.type, notes: item.notes, placeId: item.placeId, lat: item.lat, lng: item.lng,
      day: item.dayIndex === null ? null : item.dayIndex + (d.items.some(i => i.type !== 'hotel' && i.dayIndex === 0) ? 1 : 0),
      photos: item.photoUrls.length ? item.photoUrls : item.photoUrl ? [item.photoUrl] : [],
      destination: [d.name, d.country].filter(Boolean).join(', ') }))),
  }} />
}
