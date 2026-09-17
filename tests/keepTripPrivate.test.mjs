import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const code = ts.transpileModule(readFileSync(new URL('../src/actions/keepTripPrivate.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function harness(userId = 'owner') {
  const trip = { id: 'trip', userId: 'owner', visibility: 'public', title: 'Italy', isPlan: true, places: ['hotel'], notes: 'Keep these notes', photos: ['/photo.jpg'] }
  const writes = [], paths = [], exports = {}
  const prisma = { itinerary: { updateMany: async ({ where, data }) => {
    writes.push({ where, data })
    if (where.id !== trip.id || where.userId !== trip.userId) return { count: 0 }
    Object.assign(trip, data); return { count: 1 }
  } } }
  vm.runInNewContext(code, { exports, require: name => ({ '@/auth': { auth: async () => userId ? { user: { id: userId } } : null }, '@/lib/prisma': { prisma }, 'next/cache': { revalidatePath: path => paths.push(path) } })[name] })
  return { ...exports, trip, writes, paths }
}
test('keeping a published trip private only changes visibility and preserves all saved content', async () => {
  const h = harness()
  const before = { ...h.trip }
  assert.ok((await h.keepTripPrivate('trip')).success)
  assert.deepEqual(h.trip, { ...before, visibility: 'draft' })
  assert.deepEqual(Object.keys(h.writes[0].data), ['visibility'])
  assert.ok(h.paths.includes('/explore'))
  assert.ok(h.paths.includes('/user/owner'))
  assert.ok((await h.keepTripPrivate('trip')).success)
})
test('anonymous users and other accounts cannot take someone else’s trip off the feed', async () => {
  for (const user of [null, 'stranger']) {
    const h = harness(user)
    assert.ok((await h.keepTripPrivate('trip')).error)
    assert.equal(h.trip.visibility, 'public')
    assert.equal(h.paths.length, 0)
  }
})
