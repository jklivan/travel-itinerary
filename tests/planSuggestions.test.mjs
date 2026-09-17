import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createHash } from 'node:crypto'

function load(file, dependencies = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: name => dependencies[name] })
  return exports
}
const identity = load('../src/lib/planPlaceIdentity.ts')
function harness(userId = 'me') {
  const trips = [
    { id: 'plan', userId: 'me', isPlan: true, visibility: 'draft', title: 'London w kids' },
    { id: 'jen', userId: 'jen', visibility: 'public', title: 'London and Paris', createdAt: new Date(3000) },
    { id: 'sam', userId: 'sam', visibility: 'public', title: 'London favorites', createdAt: new Date(2000) },
    { id: 'stranger', userId: 'stranger', visibility: 'public', title: 'London', createdAt: new Date(1000) },
    { id: 'draft', userId: 'jen', visibility: 'draft', title: 'London secret', createdAt: new Date(4000) },
  ]
  const follows = [{ followerId: 'me', followingId: 'jen', status: 'accepted' }, { followerId: 'me', followingId: 'sam', status: 'accepted' }, { followerId: 'me', followingId: 'stranger', status: 'pending' }]
  const destinations = [
    { id: 'mine', itineraryId: 'plan', name: 'London, UK', country: null, order: 0 },
    { id: 'jen-london', itineraryId: 'jen', name: 'London', country: 'UK', order: 0 },
    { id: 'jen-paris', itineraryId: 'jen', name: 'Paris', country: 'France', order: 1 },
    { id: 'sam-london', itineraryId: 'sam', name: 'London', country: 'UK', order: 0 },
    { id: 'stranger-london', itineraryId: 'stranger', name: 'London', country: 'UK', order: 0 },
    { id: 'secret', itineraryId: 'draft', name: 'London', country: 'UK', order: 0 },
  ]
  const items = [
    { id: 'museum', destinationId: 'jen-london', name: 'Science Museum', placeId: 'google-museum', type: 'activity', order: 1, groupIndex: 0, notes: 'Jen private voice', rating: 5, photoUrls: ['/jen.jpg'], dayIndex: 3, address: 'Exhibition Rd', lat: 51.49, lng: -0.17, link: 'https://example.com' },
    { id: 'hotel', destinationId: 'jen-london', name: 'The Hotel', placeId: 'google-hotel', type: 'hotel', order: 2, groupIndex: 1 },
    { id: 'paris', destinationId: 'jen-paris', name: 'Paris Cafe', type: 'food_drink', order: 0, groupIndex: 0 },
    { id: 'cafe', destinationId: 'sam-london', name: 'London Cafe', type: 'food_drink', order: 0, groupIndex: 0 },
    { id: 'same-museum', destinationId: 'sam-london', name: 'Science Museum London', placeId: 'google-museum', type: 'activity', order: 1, groupIndex: 0 },
    { id: 'stranger-item', destinationId: 'stranger-london', name: 'Other', type: 'activity', order: 0 },
    { id: 'secret-item', destinationId: 'secret', name: 'Secret', type: 'activity', order: 0 },
  ]
  let fail = false, locks = 0
  const paths = []
  const contains = (value, search) => (value ?? '').toLowerCase().includes(search.toLowerCase())
  function tripMatches(t, where) {
    if (where.id && t.id !== where.id) return false
    if (where.userId && t.userId !== where.userId) return false
    if (where.isPlan && !t.isPlan) return false
    if (where.visibility && t.visibility !== where.visibility) return false
    if (where.destinations && !destinations.some(d => d.itineraryId === t.id && items.some(i => i.destinationId === d.id))) return false
    if (where.user) {
      const filter = where.user.followers.some
      if (!follows.some(f => f.followingId === t.userId && f.followerId === filter.followerId && f.status === filter.status)) return false
    }
    if (where.OR) return where.OR.some(filter => filter.title ? contains(t.title, filter.title.contains) : destinations.some(d => d.itineraryId === t.id && filter.destinations.some.OR.some(f => f.name ? contains(d.name, f.name.contains) : contains(d.country, f.country.contains))))
    return true
  }
  const enrich = item => ({ ...item, destination: destinations.find(d => d.id === item.destinationId) })
  const prisma = {
    itinerary: {
      findFirst: async ({ where }) => trips.find(t => tripMatches(t, where)),
      findMany: async ({ where, cursor, skip = 0, take }) => {
        let found = trips.filter(t => tripMatches(t, where)).sort((a, b) => b.createdAt - a.createdAt)
        if (cursor) found = found.slice(found.findIndex(t => t.id === cursor.id) + skip)
        return found.slice(0, take).map(t => ({ ...t, user: { name: t.userId }, destinations: destinations.filter(d => d.itineraryId === t.id).map(d => ({ ...d, items: items.filter(i => i.destinationId === d.id) })) }))
      },
    },
    destination: {
      findMany: async ({ where }) => destinations.filter(d => d.itineraryId === where.itineraryId),
      create: async ({ data }) => { const d = { id: `new-${destinations.length}`, ...data }; destinations.push(d); return d },
    },
    destItem: {
      findMany: async ({ where }) => items.filter(i => {
        const d = destinations.find(d => d.id === i.destinationId)
        if (where.id) return where.id.in.includes(i.id) && trips.find(t => t.id === d.itineraryId).visibility === where.destination.itinerary.visibility
        return d.itineraryId === where.destination.itineraryId
      }).map(enrich),
      createMany: async ({ data }) => { if (fail) throw Error('database secret'); items.push(...data); return { count: data.length } },
    },
    $queryRaw: async () => { locks++; return [{ id: 'plan' }] },
    $transaction: async callback => {
      const before = structuredClone({ destinations, items })
      try { return await callback(prisma) }
      catch (e) { destinations.splice(0, destinations.length, ...before.destinations); items.splice(0, items.length, ...before.items); throw e }
    },
  }
  const actions = load('../src/actions/planSuggestions.ts', { 'node:crypto': { createHash }, '@/auth': { auth: async () => userId ? { user: { id: userId } } : null }, '@/lib/prisma': { prisma }, '@/lib/planPlaceIdentity': identity, 'next/cache': { revalidatePath: p => paths.push(p) } })
  return { ...actions, items, trips, destinations, paths, follows, fail: () => { fail = true }, locks: () => locks, copies: () => items.filter(i => destinations.find(d => d.id === i.destinationId)?.itineraryId === 'plan') }
}

test('suggestions default to the plan city, including title-only London w kids plans', () => {
  assert.equal(identity.planSuggestionQuery('London w kids', [{ name: 'Destination to decide' }]), 'London')
  assert.equal(identity.planSuggestionQuery('London with kids', []), 'London')
  assert.equal(identity.planSuggestionQuery('Our holiday', [{ name: 'London, United Kingdom' }]), 'London')
})
test('only the owner can browse suggestions or bulk-add to their plan', async () => {
  for (const user of [null, 'someone-else']) {
    const h = harness(user)
    assert.ok((await h.findFriendsPlanPlaces('plan', 'London')).error)
    assert.ok((await h.copyPlacesToPlan(['museum'], 'plan')).error)
    assert.equal(h.copies().length, 0)
  }
})
test('London results show followed friends public trips and only matching destinations', async () => {
  const h = harness()
  const result = await h.findFriendsPlanPlaces('plan', 'London')
  assert.deepEqual(Array.from(result.trips, t => t.id), ['jen', 'sam'])
  assert.deepEqual(Array.from(result.trips[0].places, p => p.id), ['museum', 'hotel'])
  assert.ok((await h.findFriendsPlanPlaces('plan', 'London', 'stranger')).error)
  assert.ok((await h.findFriendsPlanPlaces('plan', 'London', 'draft')).error)
  assert.equal((await h.findFriendsPlanPlaces('plan', 'Rome')).trips.length, 0)
})
test('bulk copy spans friends, reuses matching city, preserves factual details, and leaves personal fields behind', async () => {
  const h = harness()
  const result = await h.copyPlacesToPlan(['museum', 'hotel', 'cafe'], 'plan')
  assert.equal(result.added, 3); assert.equal(result.skipped, 0)
  assert.equal(h.destinations.filter(d => d.itineraryId === 'plan').length, 1)
  const copies = h.copies()
  assert.deepEqual(copies.map(i => i.order), [0, 1, 2])
  assert.equal(copies[0].address, 'Exhibition Rd'); assert.equal(copies[0].placeId, 'google-museum')
  for (const item of copies) {
    assert.equal(item.dayIndex, null); assert.equal(item.planningStatus, 'considering')
    for (const field of ['notes', 'rating', 'photoUrls']) assert.equal(item[field], undefined)
  }
  assert.equal(h.locks(), 1)
  assert.ok(h.paths.includes('/plan/plan'))
})
test('duplicates across friends, repeats after refresh, and prior single-place saves are skipped', async () => {
  const h = harness()
  h.items.push({ id: 'old-single-save', destinationId: 'mine', name: ' London Cafe ', type: 'food_drink', order: 0, groupIndex: 0 })
  const first = await h.copyPlacesToPlan(['museum', 'same-museum', 'cafe'], 'plan')
  assert.equal(first.added, 1); assert.equal(first.skipped, 2)
  assert.equal((await h.copyPlacesToPlan(['museum', 'same-museum', 'cafe'], 'plan')).added, 0)
  const result = await h.findFriendsPlanPlaces('plan', 'London')
  assert.ok(result.trips[1].places.every(p => p.alreadyAdded))
  const copy = h.copies().find(i => i.placeId === 'google-museum')
  copy.name = 'My museum'; copy.placeId = null
  assert.equal((await h.copyPlacesToPlan(['museum'], 'plan')).added, 0)
  assert.equal((await h.findFriendsPlanPlaces('plan', 'London')).trips[0].places[0].alreadyAdded, true)
})
test('invalid selections or unavailable sources add nothing, and failed batches roll back new destinations', async () => {
  const h = harness()
  for (const ids of [[], ['museum', 'secret-item'], ['museum', 'missing'], [null], Array(101).fill('museum')]) assert.ok((await h.copyPlacesToPlan(ids, 'plan')).error)
  assert.equal(h.copies().length, 0)
  h.fail()
  const failed = await h.copyPlacesToPlan(['paris', 'museum'], 'plan')
  assert.match(failed.error, /try again/); assert.doesNotMatch(failed.error, /secret/)
  assert.equal(h.copies().length, 0)
  assert.equal(h.destinations.filter(d => d.itineraryId === 'plan').length, 1)
})
test('more-results cursor visits all matching friend trips without duplicates', async () => {
  const h = harness()
  for (let n = 0; n < 15; n++) {
    h.trips.push({ id: `extra-${n}`, userId: 'jen', visibility: 'public', title: 'London extra', createdAt: new Date(5000 + n) })
    h.destinations.push({ id: `extra-dest-${n}`, itineraryId: `extra-${n}`, name: 'London', order: 0 })
    h.items.push({ id: `extra-place-${n}`, destinationId: `extra-dest-${n}`, name: `Place ${n}`, type: 'activity', order: 0 })
  }
  const first = await h.findFriendsPlanPlaces('plan', 'London')
  const second = await h.findFriendsPlanPlaces('plan', 'London', first.trips.at(-1).id)
  assert.equal(first.trips.length, 12); assert.equal(first.hasMore, true)
  assert.equal(second.trips.length, 5); assert.equal(second.hasMore, false)
  assert.equal(new Set([...first.trips, ...second.trips].map(t => t.id)).size, 17)
})
