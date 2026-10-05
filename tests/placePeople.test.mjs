import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as recommendations from '../src/lib/placeRecommendation.ts'
import * as placeMatching from '../src/lib/placeMatching.ts'
const code = ts.transpileModule(readFileSync(new URL('../src/actions/placePeople.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function row(userId, options = {}) {
  return { rating: null, tags: [], notes: '', planningStatus: 'considering', ...options, destination: { itinerary: { id: 'trip-' + userId, title: 'Trip', isPlan: false, datesFlexible: false, postType: 'itinerary', endDate: new Date('2020-01-01'), user: { id: userId, name: userId }, ...options.trip } } }
}
function harness(rows = [], signedIn = true, own = null) {
  const queries = [], exports = {}
  vm.runInNewContext(code, { exports, require: name => ({ '@/auth': { auth: async () => signedIn ? { user: { id: 'me' } } : null }, '@/lib/prisma': { prisma: { follow: { findMany: async q => { queries.push(q); return [{ followingId: 'friend' }] } }, destItem: { findMany: async q => { queries.push(q); return rows }, findFirst: async () => own } } }, '@/lib/placeRecommendation': recommendations, '@/lib/placeMatching': placeMatching })[name] })
  return { run: exports.placePeople, queries }
}
test('matches exact Google place identity and restricts to public trips and visible accounts', async () => {
  const h = harness()
  await h.run('google-place')
  assert.equal(h.queries[0].where.status, 'accepted')
  const where = h.queries[1].where
  assert.equal(where.OR[0].placeId, 'google-place')
  assert.equal(where.destination.itinerary.visibility, 'public')
  assert.equal(where.destination.itinerary.userId.not, 'me')
  assert.equal(where.destination.itinerary.user.OR[0].isPrivate, false)
  assert.deepEqual(Array.from(where.destination.itinerary.user.OR[1].id.in), ['friend'])
})
test('friends first; liked means 4–5 stars or explicit recommendation, excluding avoid', async () => {
  const h = harness([row('other', { rating: 5 }), row('friend', { rating: 4 }), row('avoid', { rating: 5, tags: ['__avoid'] }), row('must', { tags: ['__highlight'] })])
  const { people } = await h.run('place')
  assert.equal(people[0].userId, 'friend')
  assert.equal(people[0].liked, true)
  assert.equal(people.find(p => p.userId === 'avoid').liked, false)
  assert.equal(people.find(p => p.userId === 'must').liked, true)
})
test('does not claim planned places, alternatives, or future trips were visited', async () => {
  const h = harness([row('plan', { trip: { isPlan: true } }), row('future', { trip: { endDate: new Date('2099-01-01') } }), row('backup', { tags: ['__option'] }), row('visited', { planningStatus: 'visited', trip: { isPlan: true } }), row('guide', { rating: 5, trip: { postType: 'guide' } })])
  const { people } = await h.run('place')
  assert.equal(people.length, 2)
  assert.equal(people.find(p => p.userId === 'visited').visited, true)
  assert.equal(people.find(p => p.userId === 'guide').visited, false)
})
test('each person appears once using their latest eligible entry', async () => {
  const h = harness([row('friend', { rating: 2 }), row('friend', { rating: 5 })])
  const { people } = await h.run('place')
  assert.equal(people.length, 1)
  assert.equal(people[0].liked, false)
})
test('anonymous requests do not query relationships or place records', async () => {
  const h = harness([], false)
  assert.ok((await h.run('place')).error)
  assert.equal(h.queries.length, 0)
})

test('unrated guide entries are included without claiming a visit or a like', async () => {
  const h = harness([row('friend', { trip: { postType: 'guide' } })])
  const { people } = await h.run('google-cru', 'CRU', 'Nantucket, MA, USA')
  assert.equal(people.length, 1)
  assert.equal(people[0].inGuide, true)
  assert.equal(people[0].visited, false)
  assert.equal(people[0].liked, false)
  const legacy = h.queries[1].where.OR[1].AND
  assert.equal(legacy[0].OR[0].placeId, null)
  assert.equal(legacy[1].name.equals, 'CRU')
  // Only the full destination and its city, never the state or country on their own.
  assert.deepEqual(Array.from(legacy[2].destination.OR, area => area.name.equals), ['Nantucket, MA, USA', 'Nantucket'])
})

test('saved legacy places without a Google ID require a name and match only their destination/locality', async () => {
  const h = harness([row('friend', { rating: 5 })])
  const result = await h.run('', 'The Berkeley', 'London, UK')
  assert.equal(result.people[0].rating, 5)
  const match = h.queries[1].where.OR[0].AND
  assert.equal(match[0].name.equals, 'The Berkeley')
  assert.deepEqual(Array.from(match[1].destination.OR, area => area.name.equals), ['London, UK', 'London'])
  const missing = harness()
  assert.ok((await missing.run('', 'The Berkeley', '')).error)
  assert.equal(missing.queries.length, 0)
})

test('a generic name like Wine tasting needs the place itself to match, not just the name and town', async () => {
  const here = { lat: 38.29, lng: -122.46, address: null }
  const nearby = row('friend', { rating: 5, placeId: null, lat: 38.2905, lng: -122.4603 })
  const elsewhere = row('other', { rating: 5, placeId: null, lat: 38.50, lng: -122.30 })
  const unknown = row('unknown', { rating: 5, placeId: null })
  const { people } = await harness([nearby, elsewhere, unknown], true, here).run('', 'Wine tasting', 'Sonoma, CA, USA', 'mine')
  assert.deepEqual(people.map(p => p.userId), ['friend'])
  // Without a map position to compare, a generic name never matches; a distinctive one in the same town still does.
  assert.equal((await harness([unknown]).run('', 'Wine Tasting', 'Sonoma, CA, USA')).people.length, 0)
  assert.equal((await harness([unknown]).run('', 'Bartholomew Estate', 'Sonoma, CA, USA')).people.length, 1)
  // Same address counts when neither has a map position.
  const addressed = row('friend', { rating: 5, placeId: null, address: '123 Main St, Sonoma, CA' })
  assert.equal((await harness([addressed], true, { lat: null, lng: null, address: '123 main st., sonoma CA' }).run('', 'Wine tasting', 'Sonoma, CA, USA', 'mine')).people.length, 1)
  assert.equal((await harness([addressed], true, { lat: null, lng: null, address: '9 Vine Rd, Sonoma, CA' }).run('', 'Wine tasting', 'Sonoma, CA, USA', 'mine')).people.length, 0)
})
