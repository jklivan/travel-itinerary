import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeIdentity from '../src/lib/planPlaceIdentity.ts'

const code = ts.transpileModule(readFileSync(new URL('../src/actions/planning.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const clientId = '12345678-1234-1234-1234-123456789012'
function form(values = {}) { const data = new FormData(); for (const [key, value] of Object.entries({ clientId, audience: 'family', title: 'Italy', destination: 'Rome', startDate: '', endDate: '', name: 'A lovely cafe', type: 'food_drink', notes: 'Reservation at 7', day: '', status: 'considering', ...values })) data.set(key, value); return data }
function harness({ user = 'owner', fail = false, zeroBased = false, empty = false, sourceVisibility = 'public' } = {}) {
  const trips = [{ id: 'trip', userId: 'owner', isPlan: true, visibility: 'draft', title: 'Italy' }]
  const destinations = [{ id: 'dest', itineraryId: 'trip', name: 'Rome' }]
  const items = empty ? [] : [{ id: 'place', destinationId: 'dest', name: 'Cafe', type: 'food_drink', notes: 'old note', photoUrls: ['/photo.jpg'], rating: 4, dayIndex: zeroBased ? 0 : null }]
  const source = { id: 'source', name: 'Museum', type: 'activity', notes: 'Personal notes', rating: 5, photoUrls: ['/theirs.jpg'], dayIndex: 5, destination: { name: 'Rome', country: 'Italy' } }
  const writes = [], paths = [], notifications = []
  const tripMatch = where => trips.find(t => (!where.id || t.id === where.id) && (!where.userId || t.userId === where.userId) && (!where.isPlan || t.isPlan) && (!where.visibility || t.visibility === where.visibility) && (!where.destinations || items.length))
  const itemMatch = where => items.find(i => i.id === where.id && (!where.destination || trips.find(t => t.id === destinations.find(d => d.id === i.destinationId)?.itineraryId)?.userId === where.destination.itinerary.userId))
  const enrich = i => i ? { ...i, destination: destinations.find(d => d.id === i.destinationId) } : null
  const prisma = {
    itinerary: {
      findUnique: async ({ where }) => tripMatch(where), findFirst: async ({ where }) => tripMatch(where), findMany: async ({ where }) => trips.filter(t => t.userId === where.userId),
      create: async ({ data }) => { if (fail) throw Error('connection contains secret'); writes.push(data); trips.push(data); return data },
      updateMany: async ({ where, data }) => { const t = tripMatch(where); if (!t) return { count: 0 }; writes.push(data); Object.assign(t, data); return { count: 1 } },
    },
    destination: { findFirst: async () => destinations[0], findMany: async ({ where }) => destinations.filter(d => d.itineraryId === where.itineraryId), count: async () => 1, create: async ({ data }) => { const created = { ...data, id: `dest-${destinations.length + 1}` }; destinations.push(created); return created } },
    destItem: {
      findUnique: async ({ where }) => enrich(items.find(i => i.id === where.id)),
      findFirst: async ({ where }) => where.id === 'source' ? sourceVisibility === where.destination.itinerary.visibility ? source : null : enrich(itemMatch(where)),
      aggregate: async () => ({ _max: { order: 0, groupIndex: 0 } }), count: async ({ where }) => items.filter(i => i.destinationId === where.destinationId && i.dayIndex === 0 && i.type !== 'hotel').length,
      create: async ({ data }) => { if (fail) throw Error('connection contains secret'); writes.push(data); items.push(data); return data },
      updateMany: async ({ where, data }) => {
        if (where.destinationId) { for (const item of items.filter(i => i.destinationId === where.destinationId && i.dayIndex !== null)) item.dayIndex++; return { count: 1 } }
        const item = itemMatch(where); if (!item) return { count: 0 }; writes.push(data); Object.assign(item, data); return { count: 1 }
      },
      deleteMany: async ({ where }) => { const item = itemMatch(where); if (item) { writes.push('delete'); items.splice(items.indexOf(item), 1) }; return { count: item ? 1 : 0 } },
    },
  }
  prisma.$transaction = async callback => callback(prisma)
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => ({ '@/auth': { auth: async () => user ? { user: { id: user } } : null }, '@/lib/prisma': { prisma }, 'next/cache': { revalidatePath: path => paths.push(path) }, '@/lib/tripPublishedNotifications': { scheduleTripPublishedNotifications: id => notifications.push(id) }, '@/lib/planPlaceIdentity': placeIdentity })[name] })
  return { actions: exports, trips, items, writes, paths, notifications }
}
test('new plans are private, dates optional, and retry returns the same trip', async () => {
  const h = harness()
  assert.equal((await h.actions.startPlan(form())).id, clientId)
  assert.equal(h.trips[1].visibility, 'draft'); assert.equal(h.trips[1].datesFlexible, true)
  assert.equal((await h.actions.startPlan(form())).id, clientId)
  assert.equal(h.trips.length, 2)
})
test('invalid or incomplete dates and empty trip titles cannot save', async () => {
  for (const values of [{ title: '', destination: '' }, { startDate: '2026-02-30', endDate: '2026-03-05' }, { startDate: '2026-03-01' }, { startDate: '2026-03-05', endDate: '2026-03-01' }]) {
    const h = harness(); assert.ok((await h.actions.startPlan(form(values))).error); assert.equal(h.writes.length, 0)
  }
})
test('valid dates save and can be cleared without affecting places', async () => {
  const h = harness(); const result = await h.actions.savePlanDetails('trip', form({ startDate: '2026-10-10', endDate: '2026-10-20' }))
  assert.ok(result.success); assert.equal(h.trips[0].datesFlexible, false)
  assert.ok((await h.actions.savePlanDetails('trip', form())).success); assert.equal(h.trips[0].datesFlexible, true); assert.equal(h.items.length, 1)
})
test('anonymous and other accounts cannot read plans or mutate their places', async () => {
  for (const user of [null, 'visitor']) {
    const h = harness({ user })
    for (const result of [await h.actions.addPlanPlace('trip', form()), await h.actions.editPlanPlace('place', form()), await h.actions.savePlanDetails('trip', form()), await h.actions.sharePlan('trip'), await h.actions.removePlanPlace('place'), await h.actions.copyPlaceToPlan('source', 'trip', clientId)]) assert.ok(result.error)
    assert.equal((await h.actions.plansForSaving()).trips.length, 0); assert.equal(h.writes.length, 0)
  }
})
test('quick add saves unscheduled notes immediately, with no duplicates on retry', async () => {
  const h = harness()
  assert.ok((await h.actions.addPlanPlace('trip', form())).success)
  assert.equal(h.items[1].notes, 'Reservation at 7'); assert.equal(h.items[1].dayIndex, null)
  assert.ok((await h.actions.addPlanPlace('trip', form())).success); assert.equal(h.items.length, 2)
  assert.ok(h.paths.includes('/plan/trip'))
})
test('editing status and schedule preserves photos and rating; legacy day zero normalizes', async () => {
  const h = harness({ zeroBased: true }); h.items.push({ id: 'other', type: 'activity', destinationId: 'dest', dayIndex: 1 })
  assert.ok((await h.actions.editPlanPlace('place', form({ day: '3', status: 'visited' }))).success)
  assert.equal(h.items[0].dayIndex, 3); assert.equal(h.items[1].dayIndex, 2)
  assert.equal(h.items[0].planningStatus, 'visited'); assert.equal(h.items[0].rating, 4); assert.deepEqual(h.items[0].photoUrls, ['/photo.jpg'])
  assert.ok((await h.actions.editPlanPlace('place', form())).success); assert.equal(h.items[0].dayIndex, null)
})
test('adding a place with a Google-style destination joins the matching destination', async () => {
  const h = harness()
  assert.ok((await h.actions.addPlanPlace('trip', form({ destination: 'Rome, Metropolitan City of Rome Capital, Italy', clientId: '22345678-1234-1234-1234-123456789012' }))).success)
  assert.equal(h.items.at(-1).destinationId, 'dest')
})
test('plan edits save the same fields as the trip editor, including photos', async () => {
  const h = harness()
  const result = await h.actions.editPlanPlace('place', form({ name: 'Cafe', mealType: 'lunch,drinks', tags: JSON.stringify(['Hidden Gem', '__must']), alternative: 'Bar Nuovo', description: 'Tiny espresso bar', link: 'https://cafe.example', address: 'Via Roma 1', photos: JSON.stringify(['/new-1.jpg', 'https://blob.example/new-2.jpg']) }))
  assert.ok(result.success)
  const item = h.items[0]
  assert.equal(item.mealType, 'lunch,drinks'); assert.deepEqual([...item.tags], ['Hidden Gem', '__must']); assert.equal(item.alternative, 'Bar Nuovo')
  assert.equal(item.description, 'Tiny espresso bar'); assert.equal(item.link, 'https://cafe.example'); assert.equal(item.address, 'Via Roma 1')
  assert.deepEqual([...item.photoUrls], ['/new-1.jpg', 'https://blob.example/new-2.jpg']); assert.equal(item.photoUrl, '/new-1.jpg')
  assert.ok((await h.actions.editPlanPlace('place', form({ name: 'Cafe', photos: '[]' }))).success)
  assert.deepEqual([...h.items[0].photoUrls], []); assert.equal(h.items[0].photoUrl, null)
})
test('plan edits reject unsafe links, photos, and meal types without saving', async () => {
  for (const values of [{ link: 'javascript:alert(1)' }, { photos: JSON.stringify(['//evil.example/x.jpg']) }, { mealType: 'brunch' }, { tags: 'not json' }]) {
    const h = harness(); assert.ok((await h.actions.editPlanPlace('place', form(values))).error); assert.equal(h.writes.length, 0)
  }
})
test('invalid day/status/category cannot mutate saved data', async () => {
  for (const values of [{ day: '0' }, { day: '366' }, { day: '1.5' }, { status: 'bad' }]) {
    const h = harness(); assert.ok((await h.actions.editPlanPlace('place', form(values))).error); assert.equal(h.writes.length, 0)
  }
  const h = harness(); assert.ok((await h.actions.addPlanPlace('trip', form({ type: 'bad' }))).error)
})
test('sharing publishes the existing trip and notifies followers only once', async () => {
  const h = harness(); const before = structuredClone(h.items)
  assert.ok((await h.actions.sharePlan('trip')).success); assert.equal(h.trips[0].visibility, 'public'); assert.deepEqual(h.items, before)
  const publishedAt = h.trips[0].publishedAt
  assert.ok(Number.isFinite(publishedAt?.getTime()))
  assert.ok((await h.actions.sharePlan('trip')).success); assert.deepEqual(h.notifications, ['trip'])
  assert.equal(h.trips[0].publishedAt, publishedAt, 'Retries must not change publication time')
  assert.ok(h.paths.includes('/'), 'Publishing invalidates the feed')
  assert.ok((await harness({ empty: true }).actions.sharePlan('trip')).error)
})
test('copying places excludes personal notes/photos/ratings and rejects private sources', async () => {
  const h = harness(); assert.ok((await h.actions.copyPlaceToPlan('source', 'trip', clientId)).success)
  const copy = h.items[1]; assert.equal(copy.name, 'Museum')
  for (const key of ['notes', 'rating', 'photoUrls', 'dayIndex']) assert.equal(copy[key], undefined)
  await h.actions.copyPlaceToPlan('source', 'trip', clientId); assert.equal(h.items.length, 2)
  const privateSource = harness({ sourceVisibility: 'draft' }); assert.ok((await privateSource.actions.copyPlaceToPlan('source', 'trip', clientId)).error); assert.equal(privateSource.writes.length, 0)
})
test('save failures are retryable and do not expose database errors', async () => {
  const h = harness({ fail: true }); const result = await h.actions.addPlanPlace('trip', form())
  assert.match(result.error, /try again/); assert.doesNotMatch(result.error, /secret/); assert.equal(h.items.length, 1)
})


test('Google place identity is saved and preserved when editing notes only', async () => {
  const h = harness()
  assert.ok((await h.actions.addPlanPlace('trip', form({ placeId: 'rome-cafe-id' }))).success)
  assert.equal(h.items[1].placeId, 'rome-cafe-id')
  Object.assign(h.items[0], { placeId: 'original-id', lat: 41.9, lng: 12.5, address: 'Rome address', link: 'https://example.com' })
  assert.ok((await h.actions.editPlanPlace('place', form({ name: 'Cafe', placeId: 'original-id' }))).success)
  assert.equal(h.items[0].placeId, 'original-id'); assert.equal(h.items[0].lat, 41.9)
  assert.ok((await h.actions.editPlanPlace('place', form({ name: 'Another cafe', placeId: 'new-id' }))).success)
  assert.equal(h.items[0].placeId, 'new-id'); assert.equal(h.items[0].lat, null); assert.equal(h.items[0].address, null)
  assert.ok((await h.actions.editPlanPlace('place', form({ name: 'Typed manually', placeId: '' }))).success)
  assert.equal(h.items[0].placeId, null)
})

test('old entry fields persist with optional scheduling and idempotent retry', async () => {
  const h = harness()
  const data = form({ rating: '4', mealType: 'lunch,dinner', tags: JSON.stringify(['Great Food', '__highlight']), photos: JSON.stringify(['/api/img?url=photo']), day: '' })
  assert.ok((await h.actions.addPlanPlace('trip', data)).success)
  const place = h.items.at(-1)
  assert.equal(place.rating, 4)
  assert.equal(place.mealType, 'lunch,dinner')
  assert.deepEqual(Array.from(place.tags), ['Great Food', '__highlight'])
  assert.deepEqual(Array.from(place.photoUrls), ['/api/img?url=photo'])
  assert.equal(place.photoUrl, '/api/img?url=photo')
  assert.equal(place.dayIndex, null)
  assert.ok((await h.actions.addPlanPlace('trip', data)).success)
  assert.equal(h.items.length, 2)
})
test('invalid entry details are rejected before any write', async () => {
  for (const values of [{ rating: '6' }, { photos: '["javascript:alert(1)"]' }, { tags: '[{}]' }, { mealType: 'unknown' }, { photos: 'not json' }]) {
    const h = harness()
    assert.ok((await h.actions.addPlanPlace('trip', form(values))).error)
    assert.equal(h.writes.length, 0)
  }
})

test('transport can be saved without a Google place and edited without changing its category', async () => {
  const h = harness()
  assert.ok((await h.actions.addPlanPlace('trip', form({ type: 'transport', name: 'Ferry to Nantucket', notes: 'Book ahead; taxis are limited', photos: JSON.stringify(['/ferry.jpg']), day: '2' }))).success)
  const item = h.items.find(item => item.id === clientId)
  assert.equal(item.type, 'transport')
  assert.equal(item.dayIndex, 2)
  assert.equal(item.notes, 'Book ahead; taxis are limited')
  assert.equal(item.photoUrl, '/ferry.jpg')
  assert.ok((await h.actions.editPlanPlace(clientId, form({ name: 'Morning ferry', notes: 'Arrive 30 minutes early', day: '3', status: 'booked' }))).success)
  assert.equal(item.type, 'transport')
  assert.equal(item.notes, 'Arrive 30 minutes early')
})

test('starting a day trip records its category and duration without calendar dates', async () => {
  const h = harness()
  await h.actions.startPlan(form({ format: 'day-trip' }))
  assert.equal(h.writes[0].durationDays, 1)
  assert.ok(h.writes[0].tags.includes('day-trip'))
  assert.equal(h.writes[0].datesFlexible, true)
})

test('copied places can receive and clear your own rating without replacing photos or notes', async () => {
  const h = harness()
  await h.actions.copyPlaceToPlan('source', 'trip', clientId)
  const copied = h.items.find(item => item.id === clientId)
  assert.equal(copied.rating, undefined)
  assert.ok((await h.actions.editPlanPlace(clientId, form({ name: 'Museum', rating: '5' }))).success)
  assert.equal(copied.rating, 5)
  assert.equal(h.items[0].rating, 4)
  assert.ok((await h.actions.editPlanPlace(clientId, form({ name: 'Museum', rating: '0' }))).success)
  assert.equal(copied.rating, null)
})

test('invalid ratings cannot change a saved place', async () => {
  for (const rating of ['-1', '6', '2.5', 'bad']) {
    const h = harness()
    assert.ok((await h.actions.editPlanPlace('place', form({ rating }))).error)
    assert.equal(h.items[0].rating, 4)
    assert.equal(h.writes.length, 0)
  }
})

test('new places retain the selected planning status', async () => {
  for (const status of ['considering', 'booked', 'visited']) {
    const h = harness()
    assert.ok((await h.actions.addPlanPlace('trip', form({ status }))).success)
    assert.equal(h.items[1].planningStatus, status)
  }
})
