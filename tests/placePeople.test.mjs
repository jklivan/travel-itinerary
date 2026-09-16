import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as recommendations from '../src/lib/placeRecommendation.ts'
const code = ts.transpileModule(readFileSync(new URL('../src/actions/placePeople.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function row(userId, options = {}) {
  return { rating: null, tags: [], notes: '', planningStatus: 'considering', ...options, destination: { itinerary: { id: 'trip-' + userId, title: 'Trip', isPlan: false, datesFlexible: false, postType: 'itinerary', endDate: new Date('2020-01-01'), user: { id: userId, name: userId }, ...options.trip } } }
}
function harness(rows = [], signedIn = true) {
  const queries = [], exports = {}
  vm.runInNewContext(code, { exports, require: name => ({ '@/auth': { auth: async () => signedIn ? { user: { id: 'me' } } : null }, '@/lib/prisma': { prisma: { follow: { findMany: async q => { queries.push(q); return [{ followingId: 'friend' }] } }, destItem: { findMany: async q => { queries.push(q); return rows } } } }, '@/lib/placeRecommendation': recommendations })[name] })
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
  assert.equal(legacy[2].destination.OR[0].name.equals, 'Nantucket')
})
