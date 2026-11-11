'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// The app's "it arrived" notice (components/ImportedNotice): trips and places that came in by email or from an AI
// assistant since you last looked, and marking them seen.
export async function unseenImports() {
  const userId = (await auth())?.user?.id
  if (!userId) return []
  const rows = await prisma.notification.findMany({ where: { recipientId: userId, kind: { in: ['trip_imported', 'places_imported'] }, readAt: null, itinerary: { isNot: null } }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, kind: true, itineraryId: true, itinerary: { select: { title: true } } } })
  return rows.map(row => ({ id: row.id, newTrip: row.kind === 'trip_imported', tripId: row.itineraryId!, title: row.itinerary?.title || 'Your trip' }))
}

export async function markImportsSeen(ids: string[]) {
  const userId = (await auth())?.user?.id
  if (!userId || !Array.isArray(ids) || ids.length > 20 || ids.some(id => typeof id !== 'string')) return
  await prisma.notification.updateMany({ where: { id: { in: ids }, recipientId: userId, readAt: null }, data: { readAt: new Date() } })
}
