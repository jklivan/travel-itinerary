import { list, del, rename } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

// Erases stored photos nothing in Postcard uses any more: removed from a place or trip, a deleted trip or snapshot,
// a replaced profile photo, a deleted account. Rather than deleting at each of those places (and missing one, or
// erasing a photo a copied trip still shows), it lists the stored photos and keeps every one whose address appears
// anywhere in the database, in any text, list or JSON column, written plainly or inside an /api/img?url= link.
// Only uploaded photos are considered (event-… and profile-… files), and only ones older than a day, so a photo
// still being added isn't taken. Unused photos go to trash/ first (the same file under trash/…), and are only
// deleted for good after 30 days there, so a mistake can be put back (restorePhotos).
const PREFIXES = ['event-', 'profile-']
const TRASH = 'trash/'
const TRASH_DAYS = 30
const GRACE_MS = 24 * 60 * 60 * 1000
// A bug in finding what's used would look like most photos being unused: stop rather than erase them.
const MAX_SHARE = 0.5
const BLOB_URL = /https:\/\/[a-z0-9-]+\.(?:private\.|public\.)?blob\.vercel-storage\.com\/[^\s"'<>?#&)\\]+/gi

// Every stored-file path the database mentions, decoded (e.g. "event-1b2c…-IMG_0042.jpg").
async function usedPaths() {
  const columns = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name::text AS table_name, column_name::text AS column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND data_type IN ('text', 'character varying', 'ARRAY', 'json', 'jsonb')`)
  const used = new Set<string>()
  for (const { table_name, column_name } of columns) {
    const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(
      `SELECT "${column_name}"::text AS value FROM "${table_name}" WHERE "${column_name}"::text LIKE '%blob.vercel-storage.com%'`)
    for (const { value } of rows) {
      let decoded = value
      try { decoded = decodeURIComponent(value) } catch { /* keep as written */ }
      for (const text of [value, decoded]) {
        for (const match of text.matchAll(BLOB_URL)) {
          const path = new URL(match[0]).pathname.slice(1)
          used.add(path)
          try { used.add(decodeURIComponent(path)) } catch { /* the plain one is there */ }
        }
      }
    }
  }
  return used
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

// Runs jobs a few at a time.
async function inBatches<T>(items: T[], size: number, job: (item: T) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) await Promise.all(items.slice(index, index + size).map(job))
}

// erase: move unused photos to the trash (and empty trash older than 30 days). confirm: the number of unused photos
// the admin saw in the report, to go ahead even when more than half look unused.
export async function cleanUpPhotos({ erase, confirm }: { erase: boolean; confirm?: number }) {
  const used = await usedPaths()
  const cutoff = Date.now() - GRACE_MS
  const stored = (await Promise.all(PREFIXES.map(listAll))).flat()
  const unused = stored.filter(blob => blob.uploadedAt.getTime() <= cutoff && !used.has(blob.pathname))
  // When the unused ones were uploaded, to compare with when features changed.
  const byMonth: Record<string, number> = {}
  for (const blob of unused) { const month = blob.uploadedAt.toISOString().slice(0, 7); byMonth[month] = (byMonth[month] ?? 0) + 1 }
  const trash = await listAll(TRASH)
  const expired = trash.filter(blob => blob.uploadedAt.getTime() < Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000)
  const report = { stored: stored.length, used: used.size, unused: unused.length, unusedMB: Math.round(unused.reduce((sum, blob) => sum + blob.size, 0) / 1e5) / 10, unusedByMonth: byMonth, examples: unused.slice(0, 10).map(blob => blob.pathname), inTrash: trash.length, movedToTrash: 0, deletedFromTrash: 0, stopped: '' }
  const confirmed = confirm === unused.length
  if (!used.size || (!confirmed && stored.length && unused.length / stored.length > MAX_SHARE)) {
    report.stopped = `Not erasing: ${unused.length} of ${stored.length} photos look unused, which is more than expected.`
    return report
  }
  if (erase || confirmed) {
    await inBatches(unused, 10, async blob => { await rename(blob.url, TRASH + blob.pathname, { access: 'private', addRandomSuffix: false, allowOverwrite: true }); report.movedToTrash++ })
    for (let index = 0; index < expired.length; index += 100) {
      await del(expired.slice(index, index + 100).map(blob => blob.url))
      report.deletedFromTrash += Math.min(100, expired.length - index)
    }
  }
  return report
}

// Puts trashed photos back where they were (same address, so trips show them again): one file, or all of them.
export async function restorePhotos(pathname: string) {
  const trash = (await listAll(TRASH)).filter(blob => pathname === 'all' || blob.pathname === TRASH + pathname)
  await inBatches(trash, 10, blob => rename(blob.url, blob.pathname.slice(TRASH.length), { access: 'private', addRandomSuffix: false, allowOverwrite: true }))
  return { restored: trash.length }
}
