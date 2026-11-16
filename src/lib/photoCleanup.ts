import { after } from 'next/server'
import { list, del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

// Deletes stored photos once nothing in Postcard uses them. A photo's file can be shared (Copy trip, copying a
// place to a plan and posting a postcard reuse the same file), so removing it from one place only deletes the file
// when no other row still mentions it, in any text, list or JSON column, written plainly or inside an /api/img link.
// Two ways in:
// - releasePhotos: right after a photo, place, trip, postcard or account is removed (scheduled with releaseLater, so
//   it runs after the response and doesn't slow the tap).
// - cleanUpPhotos: the daily job (api/cron/photo-cleanup) for uploads that were never saved (closed mid-way, an
//   abandoned postcard), only once they're a week old, and anything the first way missed.
// Every uploaded photo's file name starts with event-<uuid> or profile-<uuid>, which survives any URL encoding, so
// that's what's looked for.
const KEY = /(?:event|profile)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
const PREFIXES = ['event-', 'profile-']
const UNSAVED_DAYS = 7
// A bug in finding what's used would look like most photos being unused: the daily job stops rather than delete them.
const MAX_SHARE = 0.5

const keysIn = (texts: (string | null | undefined)[]) => new Set(texts.flatMap(text => text?.match(KEY) ?? []))

async function textColumns() {
  return prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name::text AS table_name, column_name::text AS column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND data_type IN ('text', 'character varying', 'ARRAY', 'json', 'jsonb')`)
}

// Which of these photos (by key) something in the database still mentions; every photo mentioned when keys is null.
async function stillUsed(keys: string[] | null) {
  const used = new Set<string>()
  const patterns = keys ? keys.map(key => `%${key}%`) : ['%event-%', '%profile-%']
  for (const { table_name, column_name } of await textColumns()) {
    const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(
      `SELECT "${column_name}"::text AS value FROM "${table_name}" WHERE "${column_name}"::text LIKE ANY ($1::text[])`, patterns)
    for (const key of keysIn(rows.map(row => row.value))) used.add(key)
  }
  return used
}

// Deletes the files of these photos that nothing uses any more. Pass every photo the removed thing had: ones still
// used elsewhere are kept.
export async function releasePhotos(urls: (string | null | undefined)[]) {
  const keys = [...keysIn(urls)]
  if (!keys.length) return
  const used = await stillUsed(keys)
  const gone = keys.filter(key => !used.has(key))
  const files = (await Promise.all(gone.map(key => list({ prefix: key, limit: 10 })))).flatMap(page => page.blobs.map(blob => blob.url))
  if (files.length) await del(files)
}

// releasePhotos once the response has gone; a failure is left for the daily job.
export function releaseLater(urls: (string | null | undefined)[]) {
  if (!urls.some(Boolean)) return
  after(() => releasePhotos(urls).catch(error => console.error('[photo-cleanup] release failed', error)))
}

// Every photo on these trips (cover, trip photos and pile, places, everyone's takes, deleted places kept for undo),
// read before deleting them.
export async function tripPhotoUrls(tripIds: string[]) {
  if (!tripIds.length) return []
  const trips = await prisma.itinerary.findMany({ where: { id: { in: tripIds } }, select: {
    coverPhoto: true, photos: { select: { url: true } }, deletedPlaces: { select: { data: true } },
    destinations: { select: { items: { select: { photoUrl: true, photoUrls: true, takes: { select: { photoUrls: true } } } } } },
  } })
  return trips.flatMap(trip => [trip.coverPhoto, ...trip.photos.map(photo => photo.url), ...trip.deletedPlaces.map(row => JSON.stringify(row.data)),
    ...trip.destinations.flatMap(destination => destination.items.flatMap(item => [item.photoUrl, ...item.photoUrls, ...item.takes.flatMap(take => take.photoUrls)]))])
}

// Every photo an account's deletion takes with it: their profile photo, trips, postcards, photos on other people's
// trips, and places they deleted from group trips.
export async function userPhotoUrls(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: {
    image: true, itineraries: { select: { id: true } }, stories: { select: { photoUrl: true } },
    placeTakes: { select: { photoUrls: true } }, placesDeleted: { select: { data: true } },
  } })
  if (!user) return []
  return [user.image, ...user.stories.map(story => story.photoUrl), ...user.placeTakes.flatMap(take => take.photoUrls),
    ...user.placesDeleted.map(row => JSON.stringify(row.data)), ...await tripPhotoUrls(user.itineraries.map(trip => trip.id))]
}

async function listAll(prefix: string) {
  const blobs: { url: string; pathname: string; size: number; uploadedAt: Date }[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix, cursor, limit: 1000 })
    blobs.push(...page.blobs)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return blobs
}

// The daily job. erase: delete what's unused (otherwise just report). confirm: the unused count the admin saw in
// the report, to go ahead once when more than half look unused (the first clean-up of old leftovers).
export async function cleanUpPhotos({ erase, confirm }: { erase: boolean; confirm?: number }) {
  const used = await stillUsed(null)
  const cutoff = Date.now() - UNSAVED_DAYS * 24 * 60 * 60 * 1000
  const stored = (await Promise.all(PREFIXES.map(listAll))).flat()
  // A stored file with no key (an older naming) is left alone.
  const unused = stored.filter(blob => { const keys = [...keysIn([blob.pathname])]; return blob.uploadedAt.getTime() <= cutoff && keys.length > 0 && !keys.some(key => used.has(key)) })
  // When the unused ones were uploaded, to compare with when features changed.
  const unusedByMonth: Record<string, number> = {}
  for (const blob of unused) { const month = blob.uploadedAt.toISOString().slice(0, 7); unusedByMonth[month] = (unusedByMonth[month] ?? 0) + 1 }
  const report = { stored: stored.length, used: used.size, unused: unused.length, unusedMB: Math.round(unused.reduce((sum, blob) => sum + blob.size, 0) / 1e5) / 10, unusedByMonth, examples: unused.slice(0, 10).map(blob => blob.pathname), deleted: 0, stopped: '' }
  const confirmed = confirm === unused.length
  if (!used.size || (!confirmed && stored.length && unused.length / stored.length > MAX_SHARE)) {
    report.stopped = `Not deleting: ${unused.length} of ${stored.length} photos look unused, which is more than expected.`
    return report
  }
  if (erase || confirmed) {
    for (let index = 0; index < unused.length; index += 100) {
      await del(unused.slice(index, index + 100).map(blob => blob.url))
      report.deleted += Math.min(100, unused.length - index)
    }
  }
  return report
}
