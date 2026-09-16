import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const code = ts.transpileModule(readFileSync(new URL('../src/actions/backfillPlaceIds.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function harness(admin = true, matched = true) {
  const reads = [], writes = [], exports = {}
  vm.runInNewContext(code, { exports, process: { env: { ADMIN_EMAIL: 'admin@example.com' } }, require: name => ({
    '@/auth': { auth: async () => ({ user: { email: admin ? 'admin@example.com' : 'visitor@example.com' } }) },
    '@/lib/prisma': { prisma: { destItem: { findMany: async query => { reads.push(query); return [{ id: 'old', name: 'Cru', lat: 41.28, lng: -70.09, destinationId: 'nantucket', destination: { name: 'Nantucket', country: 'United States' } }] }, updateMany: async query => { writes.push(query); return { count: 1 } } } } },
    '@/lib/placeIdentity': { resolvePlaceIdentity: async () => ({ match: matched ? { id: 'google-cru', displayName: { text: 'CRU' }, formattedAddress: 'Nantucket' } : null, reason: 'match check' }) },
    'next/cache': { revalidatePath() {} },
  })[name] })
  return { run: exports.backfillPlaceIds, reads, writes }
}
test('admin-only backfill rejects before reading data', async () => {
  const h = harness(false)
  assert.ok((await h.run({ apply: true })).error)
  assert.equal(h.reads.length, 0)
  assert.equal(h.writes.length, 0)
})
test('dry run reports the match without writing', async () => {
  const h = harness()
  assert.equal((await h.run({})).rows[0].status, 'matched')
  assert.equal(h.writes.length, 0)
})
test('apply writes only missing ID and checks that the place did not change', async () => {
  const h = harness()
  assert.equal((await h.run({ apply: true })).rows[0].status, 'saved')
  assert.deepEqual(Object.keys(h.writes[0].data), ['placeId'])
  assert.equal(h.writes[0].data.placeId, 'google-cru')
  assert.equal(h.writes[0].where.name, 'Cru')
  assert.equal(h.writes[0].where.destinationId, 'nantucket')
  assert.equal(h.writes[0].where.OR[0].placeId, null)
})
test('uncertain matches are reported and left untouched', async () => {
  const h = harness(true, false)
  assert.equal((await h.run({ apply: true })).rows[0].status, 'skipped')
  assert.equal(h.writes.length, 0)
})
