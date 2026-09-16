// One-off operator job. Defaults to read-only; --apply fills missing IDs only.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { neon } from '@neondatabase/serverless'

const apply = process.argv.includes('--apply')
if (!process.env.DATABASE_URL || !(process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API)) throw Error('Database and Google Places credentials are required.')
const sql = neon(process.env.DATABASE_URL)
const exports = {}
const source = readFileSync(new URL('../src/lib/placeIdentity.ts', import.meta.url), 'utf8')
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, fetch, AbortSignal, process: { env: process.env } })
const { resolvePlaceIdentity } = exports
const items = await sql`SELECT di.id, di.name, di.lat, di.lng, di."destinationId", d.name AS destination_name, d.country, d.lat AS destination_lat, d.lng AS destination_lng FROM "DestItem" di JOIN "Destination" d ON d.id = di."destinationId" WHERE (di."placeId" IS NULL OR di."placeId" = '') AND di.name <> '' ORDER BY di.id`
const totals = { mode: apply ? 'apply' : 'dry-run', missing: items.length, checked: 0, matched: 0, saved: 0, skipped: 0, changed: 0, errors: 0 }
const reasons = {}
const cache = new Map()
console.log('PLACE_ID_BACKFILL_START', JSON.stringify(totals))
for (let offset = 0; offset < items.length; offset += 5) {
  await Promise.all(items.slice(offset, offset + 5).map(async item => {
    const input = { name: item.name, lat: item.lat, lng: item.lng, destination: { name: item.destination_name, country: item.country, lat: item.destination_lat, lng: item.destination_lng } }
    try {
      const key = JSON.stringify(input)
      if (!cache.has(key)) cache.set(key, resolvePlaceIdentity(input))
      const result = await cache.get(key)
      if (!result.match) {
        totals.skipped++
        reasons[result.reason] = (reasons[result.reason] ?? 0) + 1
      } else {
        totals.matched++
        if (apply) {
          const saved = await sql`UPDATE "DestItem" SET "placeId" = ${result.match.id} WHERE id = ${item.id} AND name = ${item.name} AND "destinationId" = ${item.destinationId} AND ("placeId" IS NULL OR "placeId" = '') AND EXISTS (SELECT 1 FROM "Destination" d WHERE d.id = ${item.destinationId} AND d.name = ${item.destination_name} AND d.country IS NOT DISTINCT FROM ${item.country}) RETURNING id`
          if (saved.length) totals.saved++
          else totals.changed++
        }
      }
      if (item.name.toLowerCase() === 'cru' && item.destination_name.toLowerCase() === 'nantucket') console.log('CRU_NANTUCKET', JSON.stringify({ itemId: item.id, status: result.match ? apply ? 'matched-and-processed' : 'matched' : 'skipped', googleName: result.match?.displayName?.text, reason: result.reason }))
    } catch (error) {
      totals.errors++
      // Do not log database errors, credentials, or private trip contents.
      console.log('PLACE_ID_LOOKUP_ERROR', error instanceof Error && error.message.startsWith('Google Places') ? error.message : 'Lookup or update failed.')
    } finally { totals.checked++ }
  }))
  console.log('PLACE_ID_BACKFILL_PROGRESS', JSON.stringify(totals))
  if (totals.errors) throw Error('Stopped after errors; already saved IDs remain safe. Retry after resolving the API/database error.')
}
const remaining = await sql`SELECT count(*)::int AS count FROM "DestItem" WHERE ("placeId" IS NULL OR "placeId" = '') AND name <> ''`
console.log('PLACE_ID_BACKFILL_COMPLETE', JSON.stringify({ ...totals, remaining: remaining[0].count, reasons }))

const cruCheck = await sql`SELECT "placeId" IS NOT NULL AND "placeId" <> '' AS connected FROM "DestItem" WHERE id = 'cmu1dgekc000304jppp414uak'`
console.log('JEN_CRU_VERIFIED', JSON.stringify({ connected: cruCheck[0]?.connected ?? false }))
