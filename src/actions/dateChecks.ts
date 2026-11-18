'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/tripAccess'
import { asDateCheck, type DateCheck } from '@/lib/dateCheck'
import { tripDay } from '@/lib/placeDates'
import { insertIntoDay } from '@/lib/dayOrder'

// Places in your trips whose booking disagrees with their day or time (lib/dateCheck), for the app's question.
export async function pendingDateChecks() {
  const userId = (await auth())?.user?.id
  if (!userId) return []
  const items = await prisma.destItem.findMany({ where: { dateCheck: { not: Prisma.DbNull }, destination: { itinerary: canEdit(userId) } }, take: 10, orderBy: { id: 'asc' },
    select: { id: true, name: true, date: true, time: true, dayIndex: true, dateCheck: true, destination: { select: { itinerary: { select: { id: true, title: true, datesFlexible: true, startDate: true } } } } } })
  return items.flatMap(item => {
    const check = asDateCheck(item.dateCheck)
    const trip = item.destination.itinerary
    if (!check) return []
    return [{ id: item.id, name: item.name, tripId: trip.id, tripTitle: trip.title || 'Your trip', start: trip.datesFlexible ? null : trip.startDate.toISOString().slice(0, 10),
      check, current: { date: item.date?.toISOString().slice(0, 10) ?? null, time: item.time, day: item.dayIndex } }]
  })
}

// move: put the place on the booking's day and time. keep: leave it where it is. both: they're two bookings (two
// massages on different days), so it stays and a copy goes on the booking's day and time. Either way the question goes.
export async function resolveDateCheck(itemId: string, choice: 'move' | 'keep' | 'both'): Promise<{ error?: string }> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (typeof itemId !== 'string' || itemId.length > 100 || !['move', 'keep', 'both'].includes(choice)) return { error: 'Please try again.' }
  try {
    const owned = { id: itemId, destination: { itinerary: canEdit(userId) } }
    const item = await prisma.destItem.findFirst({ where: owned, select: { id: true, dayIndex: true, dateCheck: true, destination: { select: { itinerary: { select: { id: true, datesFlexible: true, startDate: true, durationDays: true } } } } } })
    if (!item) return { error: 'This place is no longer in your trip.' }
    const trip = item.destination.itinerary
    const check: DateCheck | null = asDateCheck(item.dateCheck)
    await prisma.$transaction(async tx => {
      await tx.destItem.updateMany({ where: owned, data: { dateCheck: Prisma.DbNull } })
      if (choice === 'keep' || !check) return
      const start = trip.datesFlexible ? null : trip.startDate.toISOString().slice(0, 10)
      const day = check.day ?? (check.date && start ? tripDay(check.date, start) : null)
      const nextDay = day && day >= 1 && day <= 365 ? day : item.dayIndex
      const when = { dayIndex: nextDay, ...(check.date ? { date: new Date(`${check.date}T00:00:00Z`) } : {}), ...(check.time ? { time: check.time } : {}) }
      let placed = itemId
      if (choice === 'move') await tx.destItem.updateMany({ where: owned, data: when })
      else {
        // A copy of the place (its details, photos and notes) on the booking's day and time.
        const full = await tx.destItem.findUniqueOrThrow({ where: { id: itemId }, omit: { bookingDetails: false } })
        const copy = Object.fromEntries(Object.entries(full).filter(([key]) => !['id', 'dateCheck', 'order', 'createdAt', 'updatedAt'].includes(key))) as Omit<typeof full, 'id' | 'dateCheck'>
        placed = (await tx.destItem.create({ data: { ...copy, addedById: userId, ...when }, select: { id: true } })).id
      }
      // Slotted into its new day in a sensible order (flights, the hotel, then meals by time).
      if (nextDay !== null) {
        const items = await tx.destItem.findMany({ where: { destination: { itineraryId: trip.id }, dayIndex: nextDay }, orderBy: { order: 'asc' }, select: { id: true, name: true, type: true, time: true, mealType: true } })
        const ordered = insertIntoDay(items.filter(other => other.id !== placed), items.filter(other => other.id === placed), { day: nextDay, lastDay: Math.max(trip.durationDays ?? nextDay, nextDay) })
        await Promise.all(ordered.map((other, order) => tx.destItem.update({ where: { id: other.id }, data: { order } })))
      }
    })
    for (const path of [`/plan/${trip.id}`, `/itinerary/${trip.id}`]) revalidatePath(path)
    return {}
  } catch { return { error: 'Couldn’t save that. Please try again.' } }
}
