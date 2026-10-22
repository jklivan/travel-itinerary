import assert from 'node:assert/strict'
import * as dayOrder from '../src/lib/dayOrder.ts'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeIdentity from '../src/lib/planPlaceIdentity.ts'
const importMatchLib = (() => { const out = {}; vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/importMatch.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: out, require: () => placeIdentity }); return out })()
function load(path, deps = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => deps[name] ?? (name === './placeDates' || name === '@/lib/placeDates' ? dates : undefined), Date })
  return exports
}
const dates = (() => { const exports = {}; vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/placeDates.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, Date, Number, Math, String }); return exports })()
const { importedPlaces } = load('../src/lib/planImport.ts')
const id = '12345678-1234-1234-1234-123456789012'
const places = importedPlaces({ destinations: [{ name: 'Rome', country: 'Italy', items: [{ type: 'hotel', name: 'Hotel', notes: 'Keep this note', dayIndex: 2 }, { type: 'food_drink', name: 'Cafe', dayIndex: 3, rating: 4 }, { type: 'activity', name: 'Museum' }] }] })
function harness(user = 'owner', fail = false, trip = { datesFlexible: true }) {
  const updates = []
  let items = [{ id: 'existing', name: 'Original place', destinationId: 'rome', dayIndex: null }]
  const destinations = [{ id: 'rome', name: 'Rome', country: 'Italy', itineraryId: 'plan' }]
  const tx = {
    itinerary: { findUnique: async () => ({ durationDays: trip.durationDays ?? null, tags: [] }), findFirst: async ({ where }) => where.id === 'plan' && where.userId === 'owner' ? { id: 'plan', startDate: new Date('2000-01-01T00:00:00Z'), endDate: new Date('2000-01-01T00:00:00Z'), durationDays: null, ...trip } : null, update: async ({ data }) => { updates.push(data) } },
    destination: { findFirst: async () => destinations[0] },
    destItem: {
      findUnique: async ({ where }) => items.some(item => item.id === where.id) ? { destination: { itineraryId: 'plan' } } : null,
      aggregate: async () => ({ _max: { order: items.length - 1, groupIndex: 0 } }),
      create: async ({ data }) => { if (fail && data.name === 'Cafe') throw Error('offline'); items.push(data) },
      findMany: async () => items.map(item => ({ notes: null, date: null, time: null, endDate: null, endTime: null, nights: null, dayIndex: null, ...item })),
      update: async ({ where, data }) => { const item = items.find(i => i.id === where.id); Object.assign(item, data); updates.push({ id: where.id, ...data }) },
    },
  }
  const prisma = { $transaction: async callback => { const previous = structuredClone(items); try { return await callback(tx) } catch (error) { items = previous; throw error } } }
  const action = load('../src/actions/planImport.ts', { '@/lib/importMatch': importMatchLib, '@/lib/dayOrder': dayOrder, 'next/server': { after() {} }, '@/lib/enrichPlaceIds': { enrichPlaceIds: async () => {} }, '@/auth': { auth: async () => user ? { user: { id: user } } : null }, '@/lib/prisma': { prisma }, 'next/cache': { revalidatePath() {} } }).importIntoPlan
  return { action, items: () => items, updates }
}
test('import keeps explicit days (hotels too, on their check-in day) and leaves undated places unscheduled', () => {
  assert.equal(places[0].day, 2)
  assert.equal(places[1].day, 3)
  assert.equal(places[2].day, null)
  assert.equal(places[0].notes, 'Keep this note')
})
test('import appends to the same trip without replacing its places; retry is safe', async () => {
  const h = harness()
  assert.ok((await h.action('plan', id, places)).success)
  assert.equal(h.items().length, 4)
  assert.equal(h.items()[0].name, 'Original place')
  assert.equal(h.items()[2].rating, null) // only the traveller rates places; the document's sentiment isn't used
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

test('booking dates go on their day of a dated trip; a trip without dates can take them from the bookings', async () => {
  const booked = importedPlaces({ destinations: [{ name: 'Paris', country: 'France', items: [
    { type: 'hotel', name: 'Hotel A', notes: '', date: '2026-04-03', endDate: '2026-04-06' },
    { type: 'food_drink', name: 'Bistro', notes: '', date: '2026-04-05', time: '19:30', dayIndex: 1 },
  ] }] })
  const dated = harness('owner', false, { datesFlexible: false, startDate: new Date('2026-04-01T00:00:00Z'), endDate: new Date('2026-04-07T00:00:00Z') })
  assert.ok((await dated.action('plan', id, booked)).success)
  const [hotel, dinner] = dated.items().slice(1)
  assert.equal(hotel.dayIndex, 3); assert.equal(hotel.nights, 3); assert.equal(hotel.endDate.toISOString().slice(0, 10), '2026-04-06')
  assert.equal(dinner.dayIndex, 5); assert.equal(dinner.time, '19:30') // the document's own "Day 1" is ignored
  const undated = harness()
  assert.ok((await undated.action('plan', id, booked, { start: '2026-04-03', end: '2026-04-06' })).success)
  assert.equal(undated.updates[0].datesFlexible, false); assert.equal(undated.updates[0].durationDays, 4)
  assert.equal(undated.items()[1].dayIndex, 1); assert.equal(undated.items()[2].dayIndex, 3)
})

test('a hotel keeps the nights the itinerary gives; guide awards never become a rating', () => {
  const [hotel, restaurant] = importedPlaces({ destinations: [{ name: 'Loire Valley', country: 'France', items: [
    { type: 'hotel', name: 'Château X', notes: '', dayIndex: 1, nights: 2 },
    { type: 'food_drink', name: 'Le Restaurant', notes: 'Michelin 3 keys', dayIndex: 2, rating: 5 },
  ] }, { name: 'Bordeaux', country: 'France', items: [{ type: 'hotel', name: 'Hotel Y', notes: '', dayIndex: 3, nights: 2 }] }] })
  assert.equal(hotel.day, 1); assert.equal(hotel.nights, 2); assert.equal(hotel.destination, 'Loire Valley')
  assert.equal(restaurant.rating, null)
})


test('importing a file into a trip fills in places it already has instead of adding them twice', async () => {
  const h = harness()
  h.items().push({ id: 'mayflower', name: 'The Mayflower Inn & Spa', type: 'hotel', destinationId: 'rome', dayIndex: null, notes: 'Spa first' })
  const file = [
    { name: 'Mayflower Inn and Spa', type: 'hotel', destination: 'Rome', country: 'Italy', notes: 'Confirmation 12345', mealType: '', rating: null, day: 1, date: null, time: null, endDate: null, endTime: null, nights: 2 },
    { name: 'New Trattoria', type: 'food_drink', destination: 'Rome', country: 'Italy', notes: '', mealType: '', rating: null, day: null, date: null, time: null, endDate: null, endTime: null },
    { name: 'New Trattoria', type: 'food_drink', destination: 'Rome', country: 'Italy', notes: 'Book ahead', mealType: '', rating: null, day: null, date: null, time: null, endDate: null, endTime: null },
  ]
  const result = await h.action('plan', id, file); assert.ok(result.success, JSON.stringify(result))
  const names = h.items().map(item => item.name)
  assert.equal(names.filter(name => /mayflower/i.test(name)).length, 1)
  assert.equal(names.filter(name => name === 'New Trattoria').length, 1)
  const mayflower = h.items().find(item => item.id === 'mayflower')
  assert.equal(mayflower.nights, 2); assert.equal(mayflower.dayIndex, 1); assert.equal(mayflower.notes, 'Spa first\n\nConfirmation 12345')
})

test('an unclear match is added as new unless the person says it is the same place', async () => {
  const place = { name: 'Cafe Roma', type: 'activity', destination: 'Rome', country: 'Italy', notes: 'Cooking class', mealType: '', rating: null, day: null, date: null, time: null, endDate: null, endTime: null }
  // Same name, but filed as a restaurant in the trip: not sure, so without an answer it's added as its own place.
  const h = harness(); h.items().push({ id: 'roma', name: 'Cafe Roma', type: 'food_drink', destinationId: 'rome', dayIndex: null, notes: null })
  assert.ok((await h.action('plan', id, [place])).success)
  assert.equal(h.items().filter(item => item.name === 'Cafe Roma').length, 2)
  // Answered "Same place": it fills in the existing one instead.
  const h2 = harness(); h2.items().push({ id: 'roma', name: 'Cafe Roma', type: 'food_drink', destinationId: 'rome', dayIndex: null, notes: null })
  assert.ok((await h2.action('plan', '22345678-1234-1234-1234-123456789012', [place], null, undefined, { 0: 'roma' })).success)
  assert.equal(h2.items().filter(item => item.name === 'Cafe Roma').length, 1)
  assert.equal(h2.items().find(item => item.id === 'roma').notes, 'Cooking class')
})

test('a flight out of JFK goes under the trip destination, never a New York destination of its own', () => {
  const found = importedPlaces({ destinations: [
    { name: 'New York', country: 'United States', items: [{ type: 'transport', name: 'JetBlue 2328 JFK to MBJ', date: '2026-12-19' }] },
    { name: 'Montego Bay', country: 'Jamaica', items: [{ type: 'hotel', name: 'Round Hill', date: '2026-12-20', endDate: '2026-12-23' }, { type: 'transport', name: 'JetBlue 2329 MBJ to JFK', date: '2026-12-23' }] },
  ] })
  assert.deepEqual(found.map(place => [place.name, place.destination]), [['JetBlue 2328 JFK to MBJ', 'Montego Bay'], ['Round Hill', 'Montego Bay'], ['JetBlue 2329 MBJ to JFK', 'Montego Bay']])
  assert.equal(found[0].near.name, 'New York')
  // A document with only transport keeps its own cities.
  assert.equal(importedPlaces({ destinations: [{ name: 'New York', country: '', items: [{ type: 'transport', name: 'Train' }] }] })[0].destination, 'New York')
})
