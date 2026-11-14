import { list, del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

// Erases stored photos nothing in Postcard uses any more: removed from a place or trip, a deleted trip or snapshot,
// a replaced profile photo, a deleted account. Rather than deleting at each of those places (and missing one, or
// erasing a photo a copied trip still shows), it lists the stored photos and keeps every one whose address appears
// anywhere in the database, in any text, list or JSON column, written plainly or inside an /api/img?url= link.
// Only uploaded photos are considered (event-… and profile-… files), and only ones older than a day, so a photo
// still being added isn't taken.
const PREFIXES = ['event-', 'profile-']
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

export async function cleanUpPhotos({ erase }: { erase: boolean }) {
  const used = await usedPaths()
  const cutoff = Date.now() - GRACE_MS
  let stored = 0
  const unused: { url: string; pathname: string; size: number }[] = []
  for (const prefix of PREFIXES) {
    let cursor: string | undefined
    do {
      const page = await list({ prefix, cursor, limit: 1000 })
      for (const blob of page.blobs) {
        stored++
        if (blob.uploadedAt.getTime() > cutoff || used.has(blob.pathname)) continue
        unused.push({ url: blob.url, pathname: blob.pathname, size: blob.size })
      }
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)
  }
  const report = { stored, used: used.size, unused: unused.length, unusedMB: Math.round(unused.reduce((sum, blob) => sum + blob.size, 0) / 1e5) / 10, examples: unused.slice(0, 10).map(blob => blob.pathname), erased: 0, stopped: '' }
  if (!used.size || (stored && unused.length / stored > MAX_SHARE)) {
    report.stopped = `Not erasing: ${unused.length} of ${stored} photos look unused, which is more than expected.`
    return report
  }
  if (erase) {
    for (let index = 0; index < unused.length; index += 100) {
      await del(unused.slice(index, index + 100).map(blob => blob.url))
      report.erased += Math.min(100, unused.length - index)
    }
  }
  return report
}
