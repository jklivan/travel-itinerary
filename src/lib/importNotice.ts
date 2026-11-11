import { prisma } from '@/lib/prisma'
import { deliverNotification } from '@/lib/push'

// A trip (or places) that came in without the app open, by email or from an AI assistant: a note for the person
// themselves, so the app says it arrived (components/ImportedNotice, Alerts, and a push to their iPhone).
export async function noteImported(userId: string, tripId: string, newTrip: boolean) {
  const kind = newTrip ? 'trip_imported' : 'places_imported'
  const rows = await prisma.notification.createManyAndReturn({ data: [{ recipientId: userId, actorId: userId, itineraryId: tripId, kind, dedupeKey: `${kind}:${tripId}:${Date.now()}` }], skipDuplicates: true }).catch(() => [])
  const id = rows[0]?.id
  // Straight away (imports already run in the background, where after() isn't available).
  if (id) try { await deliverNotification(id) } catch { console.error('Import push failed') }
}
