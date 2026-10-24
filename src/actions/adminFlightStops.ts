'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { flightStopFolds } from '@/lib/flightStops'
import { moveDestinationInto } from '@/lib/moveDestination'

// Admin → Flights-only stops: every trip's stops that only hold flights or transfers, and where each folds in.
export async function flightStopPlan() {
  const session = await auth()
  if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) return null
  const trips = await prisma.itinerary.findMany({ where: { destinations: { some: { items: { some: { type: 'transport' } } } } }, orderBy: { createdAt: 'desc' }, select: {
    id: true, title: true, visibility: true, user: { select: { name: true } },
    destinations: { select: { id: true, name: true, order: true, days: true, items: { select: { name: true, type: true } } } } } })
  return trips.flatMap(trip => flightStopFolds(trip.destinations).map(({ from, into }) => ({
    tripId: trip.id, title: trip.title, owner: trip.user.name, posted: trip.visibility !== 'draft',
    from: { id: from.id, name: from.name, days: from.days, places: from.items.map(item => item.name) }, into: { id: into.id, name: into.name, days: into.days },
  })))
}

export async function fixFlightStops() {
  const plan = await flightStopPlan()
  if (!plan) return { error: 'Administrator sign-in required.' }
  let fixed = 0
  for (const fold of plan) {
    await prisma.$transaction(async tx => {
      // Still a flights-only stop of the same trip (nothing changed since the list was made).
      const from = await tx.destination.findFirst({ where: { id: fold.from.id, itineraryId: fold.tripId, items: { every: { type: 'transport' }, some: {} } }, select: { id: true, days: true } })
      const into = await tx.destination.findFirst({ where: { id: fold.into.id, itineraryId: fold.tripId }, select: { id: true, days: true } })
      if (from && into) { await moveDestinationInto(tx, from, into); fixed++ }
    }, { timeout: 30000 })
    for (const path of [`/plan/${fold.tripId}`, `/itinerary/${fold.tripId}`]) revalidatePath(path)
  }
  revalidatePath('/'); revalidatePath('/admin/flight-stops')
  return { fixed }
}
