import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const code = compile('../src/actions/quickSavePlan.ts')
const storyExports = {}
vm.runInNewContext(compile('../src/lib/stories.ts'), { exports: storyExports })
function harness({ userId = 'me', visibility = 'public', expired = false, fail = false, race = false } = {}) {
  const copies = [], queries = [], paths = []
  const place = { name: 'Science Museum', type: 'activity', destination: { name: 'London', country: 'UK' }, placeId: 'google-id', lat: 51.5, lng: -0.1, address: 'Exhibition Road', link: 'https://example.com', notes: 'Their notes', rating: 5, photoUrls: ['/photo.jpg'] }
  const snapshot = { placeName: 'Cafe', type: 'food_drink', destination: 'Paris', country: 'France', caption: 'Their story', sourceItineraryId: 'private-trip' }
  const summary = trip => trip ? { id: trip.id, title: trip.title } : null
  const prisma = {
    itinerary: { findFirst: async ({ where }) => summary(copies.find(t => t.id === where.id && t.userId === where.userId)), create: async ({ data }) => {
      if (fail) throw Error('database credentials')
      copies.push(data)
      if (race) throw Object.assign(Error('duplicate'), { code: 'P2002' })
      return summary(data)
    } },
    destItem: { findFirst: async ({ where }) => { queries.push(where); return where.id === 'place' && where.destination.itinerary.visibility === visibility ? place : null } },
    story: { findFirst: async ({ where }) => { queries.push(where); return where.id === 'story' && !expired ? snapshot : null } },
  }
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => ({ 'node:crypto': { createHash }, '@/auth': { auth: async () => userId ? { user: { id: userId } } : null }, '@/lib/prisma': { prisma }, '@/lib/stories': storyExports, 'next/cache': { revalidatePath: p => paths.push(p) } })[name] })
  return { ...exports, copies, queries, paths, input: { itemId: 'place', clientId: '12345678-1234-1234-1234-123456789012' } }
}
test('New trip atomically creates a private flexible plan with temporary destination title and selected place', async () => {
  const h = harness()
  const result = await h.savePlaceToNewPlan(h.input)
  assert.equal(result.trip.title, 'Trip to London')
  const plan = h.copies[0]
  assert.equal(plan.userId, 'me'); assert.equal(plan.visibility, 'draft'); assert.equal(plan.isPlan, true); assert.equal(plan.datesFlexible, true)
  assert.equal(plan.destinations.create.name, 'London')
  const place = plan.destinations.create.items.create
  assert.equal(place.name, 'Science Museum'); assert.equal(place.placeId, 'google-id'); assert.equal(place.dayIndex, null)
  assert.equal(place.notes, undefined); assert.equal(place.rating, undefined); assert.equal(place.photoUrls, undefined)
  assert.ok(h.paths.includes(`/plan/${result.trip.id}`))
})
test('retries and concurrent double taps return the same plan and first place', async () => {
  for (const race of [false, true]) {
    const h = harness({ race })
    const first = await h.savePlaceToNewPlan(h.input)
    const second = await h.savePlaceToNewPlan(h.input)
    assert.equal(first.trip.id, second.trip.id); assert.equal(h.copies.length, 1)
  }
})
test('missing, private, malformed and anonymous sources cannot create a trip', async () => {
  for (const options of [{ userId: null }, { visibility: 'draft' }]) {
    const h = harness(options)
    assert.ok((await h.savePlaceToNewPlan(h.input)).error); assert.equal(h.copies.length, 0)
  }
  const h = harness()
  for (const input of [null, { ...h.input, itemId: 'missing' }, { ...h.input, clientId: 'bad' }, { ...h.input, storyId: 'story' }, { ...h.input, itemId: 4 }]) assert.ok((await h.savePlaceToNewPlan(input)).error)
  assert.equal(h.copies.length, 0)
})
test('story saves use the visible snapshot and do not expose the source private itinerary', async () => {
  const h = harness()
  const result = await h.savePlaceToNewPlan({ storyId: 'story', clientId: h.input.clientId })
  assert.equal(result.trip.title, 'Trip to Paris')
  assert.equal(h.copies[0].destinations.create.items.create.name, 'Cafe')
  assert.equal(h.copies[0].sourceItineraryId, undefined)
  assert.ok(h.queries[0].expiresAt.gt)
  const expired = harness({ expired: true })
  assert.ok((await expired.savePlaceToNewPlan({ storyId: 'story', clientId: h.input.clientId })).error)
  assert.equal(expired.copies.length, 0)
})
test('a failed nested save leaves no empty trip and returns a retryable message', async () => {
  const h = harness({ fail: true })
  const result = await h.savePlaceToNewPlan(h.input)
  assert.match(result.error, /try again/); assert.doesNotMatch(result.error, /credentials/)
  assert.equal(h.copies.length, 0)
})
