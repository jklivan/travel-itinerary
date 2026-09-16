import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(path, deps = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => deps[name] })
  return exports
}
const { importedPlaces } = load('../src/lib/planImport.ts')
const id = '12345678-1234-1234-1234-123456789012'
const places = importedPlaces({ destinations: [{ name: 'Rome', country: 'Italy', items: [{ type: 'hotel', name: 'Hotel', notes: 'Keep this note', dayIndex: 2 }, { type: 'food_drink', name: 'Cafe', dayIndex: 3, rating: 4 }, { type: 'activity', name: 'Museum' }] }] })
function harness(user = 'owner', fail = false) {
  let items = [{ id: 'existing', name: 'Original place', destinationId: 'rome', dayIndex: null }]
  const destinations = [{ id: 'rome', name: 'Rome', country: 'Italy', itineraryId: 'plan' }]
  const tx = {
    itinerary: { findFirst: async ({ where }) => where.id === 'plan' && where.userId === 'owner' ? { id: 'plan' } : null },
    destination: { findFirst: async () => destinations[0] },
    destItem: {
      findUnique: async ({ where }) => items.some(item => item.id === where.id) ? { destination: { itineraryId: 'plan' } } : null,
      aggregate: async () => ({ _max: { order: items.length - 1, groupIndex: 0 } }),
      create: async ({ data }) => { if (fail && data.name === 'Cafe') throw Error('offline'); items.push(data) },
    },
  }
  const prisma = { $transaction: async callback => { const previous = structuredClone(items); try { return await callback(tx) } catch (error) { items = previous; throw error } } }
  const action = load('../src/actions/planImport.ts', { '@/auth': { auth: async () => user ? { user: { id: user } } : null }, '@/lib/prisma': { prisma }, 'next/cache': { revalidatePath() {} } }).importIntoPlan
  return { action, items: () => items }
}
test('import keeps explicit days and leaves undated places unscheduled', () => {
  assert.equal(places[0].day, null)
  assert.equal(places[1].day, 3)
  assert.equal(places[2].day, null)
  assert.equal(places[0].notes, 'Keep this note')
})
test('import appends to the same trip without replacing its places; retry is safe', async () => {
  const h = harness()
  assert.ok((await h.action('plan', id, places)).success)
  assert.equal(h.items().length, 4)
  assert.equal(h.items()[0].name, 'Original place')
  assert.equal(h.items()[2].rating, 4)
  assert.equal(h.items()[2].dayIndex, 3)
  assert.ok(h.items().every(item => item.destinationId === 'rome'))
  assert.ok((await h.action('plan', id, places)).success)
  assert.equal(h.items().length, 4)
})
test('failed batch rolls back the complete import', async () => {
  const h = harness('owner', true)
  assert.ok((await h.action('plan', id, places)).error)
  assert.equal(h.items().length, 1)
})
test('anonymous and other accounts cannot import into a trip', async () => {
  for (const user of [null, 'visitor']) {
    const h = harness(user)
    assert.ok((await h.action('plan', id, places)).error)
    assert.equal(h.items().length, 1)
  }
})
test('invalid places are rejected before saving', async () => {
  const h = harness()
  for (const updates of [{ day: 0 }, { rating: 8 }, { name: '' }, { type: 'bad' }, { notes: 'x'.repeat(8001) }]) assert.ok((await h.action('plan', id, [{ ...places[0], ...updates }])).error)
  assert.equal(h.items().length, 1)
})
