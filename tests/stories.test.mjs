import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function module(path, deps = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, Date, require: name => deps[name] })
  return exports
}
const photos = module('../src/lib/eventPhotos.ts')
const lib = module('../src/lib/stories.ts')
const id = '12345678-1234-1234-1234-123456789012'
function harness(user = 'owner', itemType = 'hotel') {
  const rows = [], queries = [], plans = [], destinations = [], addedItems = []
  const item = { id: 'place', name: 'Hotel', type: itemType, photoUrl: '/old.jpg', photoUrls: ['/old.jpg'], notes: 'secret notes', destination: { itineraryId: 'private', name: 'Rome', country: 'Italy' } }
  const prisma = {
    story: {
      findUnique: async ({ where }) => rows.find(row => row.id === where.id),
      create: async ({ data }) => { rows.push(data); return data },
      findMany: async query => { queries.push(query); return query.where?.id?.in ? rows.filter(row => query.where.id.in.includes(row.id)) : rows },
      createMany: async ({ data }) => { rows.push(...data); return { count: data.length } },
      findFirst: async query => { queries.push(query); return rows.find(row => row.id === query.where.id && row.expiresAt > query.where.expiresAt.gt) },
      deleteMany: async ({ where }) => { const index = rows.findIndex(row => row.id === where.id && row.userId === where.userId); if (index < 0) return { count: 0 }; rows.splice(index, 1); return { count: 1 } },
    },
    destItem: { findFirst: async ({ where }) => where.destination.itinerary.userId === 'owner' ? item : null, updateMany: async ({data}) => { Object.assign(item, data); return { count: 1 } }, aggregate: async () => ({ _max: { order: -1, groupIndex: -1 } }), create: async ({ data }) => { const created = { ...data, id: 'new-place', lat: null, lng: null }; addedItems.push(created); return created } },
    destination: { findFirst: async ({ where }) => destinations.find(destination => destination.itineraryId === where.itineraryId && destination.name.toLowerCase() === where.name.equals.toLowerCase()) ?? null, create: async ({ data }) => { const created = { ...data, id: `destination-${destinations.length + 1}` }; destinations.push(created); return created }, count: async ({ where }) => destinations.filter(destination => destination.itineraryId === where.itineraryId).length },
    user: { findUnique: async () => ({ isPrivate: false }) },
    itinerary: { create: async ({ data }) => { plans.push(data); return data }, findFirst: async () => ({ id: 'plan' }), findMany: async query => { queries.push(query); return [] } },
  }
  prisma.$transaction = async callback => {
    const before = structuredClone(item), beforeRows = rows.length, beforePlans = plans.length, beforeDestinations = destinations.length, beforeItems = addedItems.length
    try { return await callback(prisma) }
    catch (error) { Object.assign(item, before); rows.splice(beforeRows); plans.splice(beforePlans); destinations.splice(beforeDestinations); addedItems.splice(beforeItems); throw error }
  }
  const actions = module('../src/actions/stories.ts', { '@/auth': { auth: async () => user ? { user: { id: user } } : null }, '@/lib/prisma': { prisma }, 'next/cache': { revalidatePath() {} }, '@/lib/eventPhotos': photos, '@/lib/stories': lib })
  return { actions, rows, queries, item, prisma, plans, destinations, addedItems }
}
const input = { id, itemId: 'place', photoUrl: '/photo.jpg', caption: 'Great stay' }
test('posting a new activity creates an editable itinerary and adds the place to it', async () => {
  const h = harness()
  const newPlanId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const result = await h.actions.postStory({ id, placeName: 'A lakeside walk', destination: 'Lucerne', country: 'Switzerland', type: 'activity', placeId: 'google-place-id', newPlanId, newPlanTitle: 'Lucerne weekend', photoUrl: '/walk.jpg', caption: 'So peaceful' })
  assert.ok(result.success)
  assert.equal(h.rows.length, 1)
  assert.equal(h.rows[0].sourceItineraryId, newPlanId)
  assert.equal(h.rows[0].sourceItemId, 'new-place')
  assert.equal(h.rows[0].placeName, 'A lakeside walk')
  assert.equal(h.rows[0].destination, 'Lucerne')
  assert.equal(h.rows[0].country, 'Switzerland')
  assert.equal(h.rows[0].type, 'activity')
  assert.equal(h.rows[0].placeId, 'google-place-id')
  assert.equal(h.plans[0].id, newPlanId)
  assert.equal(h.plans[0].title, 'Lucerne weekend')
  assert.equal(h.plans[0].isPlan, true)
  assert.equal(h.destinations[0].name, 'Lucerne')
  assert.equal(h.addedItems[0].photoUrl, '/walk.jpg')
})
test('posting a new activity from a story adds it to an existing itinerary', async () => {
  const h = harness()
  const result = await h.actions.postStory({ id, placeName: 'A new cafe', destination: 'Rome', country: 'Italy', type: 'food_drink', tripId: 'plan', photoUrl: '/cafe.jpg', caption: 'Great coffee' })
  assert.ok(result.success)
  assert.equal(h.plans.length, 0)
  assert.equal(h.addedItems[0].name, 'A new cafe')
  assert.equal(h.rows[0].sourceItineraryId, 'plan')
})
test('posting expires exactly 24 hours later and retries do not extend expiry', async () => {
  const h = harness()
  assert.ok((await h.actions.postStory(input)).success)
  const row = h.rows[0]
  assert.equal(row.expiresAt - row.createdAt, 86400000)
  assert.equal(row.notes, undefined)
  assert.ok((await h.actions.postStory(input)).success)
  assert.equal(h.rows.length, 1)
  row.expiresAt = new Date(Date.now() - 1)
  assert.ok((await h.actions.postStory(input)).error)
  assert.equal(h.rows.length, 1)
})
test('posting multiple selected photos creates ordered stories and saves every photo to the place', async () => {
  const h = harness()
  const result = await h.actions.postStories({ itemId: 'place', caption: 'A lovely stay', photos: [
    { id, photoUrl: '/photo-1.jpg' },
    { id: '22345678-1234-1234-1234-123456789012', photoUrl: '/photo-2.jpg' },
    { id: '32345678-1234-1234-1234-123456789012', photoUrl: '/photo-3.jpg' },
  ] })
  assert.ok(result.success)
  assert.deepEqual(h.rows.map(row => row.photoUrl), ['/photo-1.jpg', '/photo-2.jpg', '/photo-3.jpg'])
  assert.deepEqual(Array.from(h.item.photoUrls), ['/old.jpg', '/photo-1.jpg', '/photo-2.jpg', '/photo-3.jpg'])
  assert.ok(h.rows[0].createdAt < h.rows[1].createdAt && h.rows[1].createdAt < h.rows[2].createdAt)
  assert.ok(h.rows.every(row => row.expiresAt - row.createdAt === 86400000))
})
test('only owners can post their place; anonymous posts rejected', async () => {
  for (const user of [null, 'stranger']) {
    const h = harness(user)
    assert.ok((await h.actions.postStory(input)).error)
    assert.equal(h.rows.length, 0)
  }
})
test('private plan links are shown only to the owner', async () => {
  const h = harness()
  await h.actions.postStory(input)
  Object.assign(h.rows[0], { user: { id: 'owner', name: 'Alice' }, sourceItinerary: { id: 'private', visibility: 'draft', isPlan: true } })
  const result = (await h.actions.activeStories())[0]
  assert.equal(result.tripHref, '/plan/private')
  assert.equal(result.sourceItineraryId, undefined)
  assert.equal(result.sourceItemId, undefined)
  assert.equal(result.notes, undefined)
  const viewer = harness('viewer')
  viewer.rows.push(h.rows[0])
  assert.equal((await viewer.actions.activeStories())[0].tripHref, null)
  h.rows[0].sourceItinerary.visibility = 'public'
  assert.equal((await h.actions.activeStories())[0].tripHref, '/itinerary/private')
})
test('story reads enforce expiry and accepted followers, including anonymous Following', () => {
  const now = new Date()
  const where = lib.visibleStoriesWhere('viewer', true, now)
  assert.equal(where.expiresAt.gt, now)
  assert.equal(where.OR.length, 2)
  assert.equal(where.OR[1].user.followers.some.status, 'accepted')
  assert.equal(where.OR[1].user.followers.some.followerId, 'viewer')
  assert.equal(lib.visibleStoriesWhere(null, true).OR.length, 0)
  assert.equal(lib.visibleStoriesWhere(null).OR[0].user.isPrivate, false)
})
test('story picker lists the newest itineraries first', async () => {
  const h = harness()
  await h.actions.storySources()
  assert.equal(h.queries.at(-1).orderBy.createdAt, 'desc')
})
test('expired stories cannot be copied to a plan', async () => {
  const h = harness()
  await h.actions.postStory(input)
  h.rows[0].expiresAt = new Date(Date.now() - 1)
  assert.ok((await h.actions.copyStoryToPlan(id, 'plan', id)).error)
  assert.ok(h.queries.find(query => query.where?.expiresAt)?.where.expiresAt.gt instanceof Date)
})
test('deletion is scoped to current account', async () => {
  const h = harness()
  h.rows.push({ id, userId: 'stranger' })
  assert.ok((await h.actions.deleteStory(id)).error)
  assert.equal(h.rows.length, 1)
  h.rows[0].userId = 'owner'
  assert.ok((await h.actions.deleteStory(id)).success)
  assert.equal(h.rows.length, 0)
})

 test('transport stories preserve the category, photo and 24-hour expiry', async () => {
  const h = harness('owner', 'transport')
  assert.ok((await h.actions.postStory({ ...input, caption: 'The ferry ride' })).success)
  assert.equal(h.rows[0].type, 'transport')
  assert.equal(h.rows[0].photoUrl, input.photoUrl)
  assert.equal(h.rows[0].caption, 'The ferry ride')
  assert.equal(h.rows[0].expiresAt - h.rows[0].createdAt, 24 * 60 * 60 * 1000)
})

test('story photos remain on the source place after story deletion and retries do not duplicate them', async () => {
  const h = harness()
  await h.actions.postStory(input)
  await h.actions.postStory(input)
  assert.deepEqual(Array.from(h.item.photoUrls), ['/old.jpg', '/photo.jpg'])
  assert.equal(h.item.photoUrl, '/old.jpg')
  await h.actions.deleteStory(id)
  assert.deepEqual(Array.from(h.item.photoUrls), ['/old.jpg', '/photo.jpg'])
})
test('a failed story write rolls back its photo addition', async () => {
  const h = harness()
  h.prisma.story.createMany = async () => { throw new Error('Unavailable') }
  assert.ok((await h.actions.postStory(input)).error)
  assert.deepEqual(h.item.photoUrls, ['/old.jpg'])
  assert.equal(h.rows.length, 0)
})
test('concurrent photo edits abort posting instead of replacing the photo list', async () => {
  const h = harness()
  h.prisma.destItem.updateMany = async () => ({ count: 0 })
  assert.ok((await h.actions.postStory(input)).error)
  assert.equal(h.rows.length, 0)
})
