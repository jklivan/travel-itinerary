import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createHash } from 'node:crypto'

const code = ts.transpileModule(readFileSync(new URL('../src/actions/copyTrip.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function harness({ userId = 'me', owner = 'me', visibility = 'public', fail = false, race = false } = {}) {
  const source = { id: 'capri', userId: owner, visibility, title: 'Capri last summer', audience: 'family', notes: 'Trip advice', tripRating: 5, photos: [{ url: '/old.jpg' }], destinations: [
    { id: 'old-destination', name: 'Capri', country: 'Italy', lat: 40.55, lng: 14.24, notes: 'Island tips', order: 0, items: [
      { id: 'old-hotel', name: 'Hotel', type: 'hotel', groupIndex: 2, order: 0, dayIndex: null, planningStatus: 'booked', notes: 'Ask for a sea view', rating: 5, photoUrls: ['/room.jpg'], placeId: 'hotel-google', address: 'Marina', link: 'https://example.com', lat: 40.55, lng: 14.24 },
      { id: 'old-cafe', name: 'Cafe', type: 'food_drink', mealType: 'lunch', groupIndex: 0, order: 1, dayIndex: 0, planningStatus: 'visited', notes: 'Favorite lunch', tags: ['__highlight'], rating: 4 },
      { id: 'old-boat', name: 'Boat ride', type: 'transport', groupIndex: 0, order: 2, dayIndex: 1, planningStatus: 'visited' },
    ] },
    { id: 'old-naples', name: 'Naples', country: 'Italy', order: 1, items: [] },
  ] }
  const copies = [], paths = []
  let sourceReads = 0
  const prisma = { itinerary: {
    findUnique: async ({ where }) => copies.find(c => c.id === where.id),
    findFirst: async ({ where }) => { sourceReads++; return where.id === source.id && where.OR.some(f => f.userId ? f.userId === source.userId : f.visibility === source.visibility) ? source : null },
    create: async ({ data }) => {
      if (fail) throw Error('private database details')
      copies.push(data)
      if (race) throw Object.assign(Error('unique conflict'), { code: 'P2002' })
      return data
    },
  } }
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => ({ 'node:crypto': { createHash }, '@/auth': { auth: async () => userId ? { user: { id: userId } } : null }, '@/lib/prisma': { prisma }, 'next/cache': { revalidatePath: p => paths.push(p) } })[name] })
  const input = { sourceId: 'capri', clientId: '12345678-1234-1234-1234-123456789012', title: 'Capri next summer', keepDays: true, keepNotes: true }
  return { ...exports, input, source, copies, paths, sourceReads: () => sourceReads }
}

test('own itinerary becomes a separate private plan, preserving places and normalized day layout', async () => {
  const h = harness(); const before = structuredClone(h.source)
  const result = await h.copyTripToPlan(h.input)
  assert.ok(result.id)
  const copy = h.copies[0]
  assert.notEqual(copy.id, h.source.id)
  assert.equal(copy.title, 'Capri next summer'); assert.equal(copy.userId, 'me')
  assert.equal(copy.visibility, 'draft'); assert.equal(copy.isPlan, true); assert.equal(copy.datesFlexible, true)
  assert.equal(copy.startDate.toISOString(), '2000-01-01T00:00:00.000Z')
  assert.equal(copy.notes, 'Trip advice'); assert.equal(copy.photos, undefined); assert.equal(copy.tripRating, undefined)
  const destinations = copy.destinations.create
  assert.equal(destinations.length, 2)
  assert.equal(destinations[0].id, undefined); assert.equal(destinations[0].notes, 'Island tips')
  const places = destinations[0].items.create
  assert.deepEqual(Array.from(places, i => i.dayIndex), [null, 1, 2])
  assert.equal(places[0].placeId, 'hotel-google'); assert.equal(places[0].address, 'Marina')
  assert.equal(places[1].mealType, 'lunch'); assert.equal(places[2].type, 'transport')
  for (const place of places) {
    assert.equal(place.id, undefined); assert.equal(place.destinationId, undefined)
    assert.equal(place.planningStatus, 'considering'); assert.equal(place.rating, undefined); assert.equal(place.photoUrls, undefined); assert.equal(place.tags, undefined)
  }
  assert.deepEqual(h.source, before)
  assert.ok(h.paths.includes(`/plan/${result.id}`)); assert.ok(h.paths.includes('/user/me'))
})
test('anyone else’s public itinerary can be copied, without claiming their notes or memories', async () => {
  const h = harness({ owner: 'jen' })
  assert.ok((await h.copyTripToPlan(h.input)).id)
  const copy = h.copies[0]
  assert.equal(copy.userId, 'me'); assert.equal(copy.notes, null)
  assert.equal(copy.destinations.create[0].notes, null)
  assert.ok(copy.destinations.create[0].items.create.every(p => p.notes === null))
})
test('own private plans can be copied but other travelers private or missing trips cannot', async () => {
  assert.ok((await harness({ visibility: 'draft' }).copyTripToPlan(harness().input)).id)
  const other = harness({ owner: 'jen', visibility: 'draft' })
  assert.ok((await other.copyTripToPlan(other.input)).error); assert.equal(other.copies.length, 0)
  const missing = harness()
  assert.ok((await missing.copyTripToPlan({ ...missing.input, sourceId: 'missing' })).error)
})
test('day layout and own notes can be omitted, and one-based days are preserved', async () => {
  const h = harness()
  await h.copyTripToPlan({ ...h.input, keepDays: false, keepNotes: false })
  assert.equal(h.copies[0].notes, null)
  assert.ok(h.copies[0].destinations.create[0].items.create.every(i => i.dayIndex === null && i.notes === null))
  const next = harness()
  next.source.destinations[0].items[1].dayIndex = 1; next.source.destinations[0].items[2].dayIndex = 2
  await next.copyTripToPlan(next.input)
  assert.deepEqual(Array.from(next.copies[0].destinations.create[0].items.create, i => i.dayIndex), [null, 1, 2])
})
test('lost-response retries and concurrent duplicate requests return the existing copy', async () => {
  const h = harness()
  const first = await h.copyTripToPlan(h.input)
  assert.equal((await h.copyTripToPlan(h.input)).id, first.id)
  assert.equal(h.copies.length, 1); assert.equal(h.sourceReads(), 1)
  const concurrent = harness({ race: true })
  assert.ok((await concurrent.copyTripToPlan(concurrent.input)).id)
  assert.equal(concurrent.copies.length, 1)
  const secondVisit = await h.copyTripToPlan({ ...h.input, clientId: 'abcdefab-1234-1234-1234-123456789012' })
  assert.notEqual(secondVisit.id, first.id); assert.equal(h.copies.length, 2)
})
test('sign-in, input validation and failures cannot create incomplete copies or expose errors', async () => {
  const anon = harness({ userId: null })
  assert.ok((await anon.copyTripToPlan(anon.input)).error); assert.equal(anon.copies.length, 0)
  const h = harness()
  for (const input of [null, { ...h.input, title: ' ' }, { ...h.input, title: 'x'.repeat(161) }, { ...h.input, clientId: 'bad' }, { ...h.input, keepDays: 'yes' }, { ...h.input, sourceId: 2 }]) assert.ok((await h.copyTripToPlan(input)).error)
  assert.equal(h.copies.length, 0)
  const failure = harness({ fail: true })
  const result = await failure.copyTripToPlan(failure.input)
  assert.match(result.error, /try again/); assert.doesNotMatch(result.error, /database/); assert.equal(failure.copies.length, 0)
})
