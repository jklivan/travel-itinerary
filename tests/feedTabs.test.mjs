import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as jsx from 'react/jsx-runtime'
import * as React from 'react'
const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
async function feed(activeFeed, userId = 'alice', searchQuery = '') {
  const queries = []
  const follows = []
  const exports = {}
  const dependencies = {
    '@/auth': { auth: async () => userId ? { user: { id: userId } } : null },
    '@/lib/prisma': { prisma: {
      follow: { findMany: async query => { follows.push(query); return [{ followingId: 'bob' }] } },
      itinerary: { findMany: async query => { queries.push(query); return [] } },
      bucketListItem: { findMany: async () => [] },
    } },
    '@/components/StoryFeed': { default: () => null },
    '@/components/PlanningShortcut': { default: () => null },
    '@/components/ItineraryCard': { default: () => null },
    'next/link': { default: 'a' }, react: React, 'react/jsx-runtime': jsx,
  }
  vm.runInNewContext(ts.transpileModule(source + '\nexports.results = FeedResults', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, URLSearchParams, require: name => dependencies[name] })
  const element = await exports.results({ activeFeed, searchQuery })
  return { queries, follows, element }
}
test('Following filters to accepted follows and excludes drafts and empty trips', async () => {
  const h = await feed('following')
  assert.equal(h.follows[0].where.followerId, 'alice')
  assert.equal(h.follows[0].where.status, 'accepted')
  assert.deepEqual(Array.from(h.queries[0].where.userId.in), ['bob'])
  assert.equal(h.queries[0].where.visibility.not, 'draft')
  assert.ok(h.queries[0].where.destinations.some.items.some)
})
test('For You keeps the discovery feed and does not query follows', async () => {
  const h = await feed('for-you')
  assert.equal(h.follows.length, 0)
  assert.equal(h.queries[0].where.userId, undefined)
  assert.equal(h.queries.length, 1)
})
test('anonymous Following cannot fall back to everyone’s trips', async () => {
  const h = await feed('following', null)
  assert.equal(h.follows.length, 0)
  assert.equal(h.queries[0].where.userId.in.length, 0)
})
test('existing search links retain Following and nonempty-trip filters', async () => {
  const h = await feed('following', 'alice', 'Paris')
  const where = h.queries[0].where
  assert.ok(where.destinations.some.items.some)
  assert.equal(where.destinations.some.OR[0].name.contains, 'Paris')
  assert.deepEqual(Array.from(where.userId.in), ['bob'])
})
