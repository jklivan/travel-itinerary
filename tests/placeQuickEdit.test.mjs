import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { eventPhotos } from '../src/lib/eventPhotos.ts'

const code = ts.transpileModule(readFileSync(new URL('../src/actions/placeQuickEdit.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function harness({ user = 'owner', concurrent = false, fail = false } = {}) {
  const item = { id: 'event', owner: 'owner', rating: 3, notes: 'Keep my notes', photoUrl: '/old.jpg', photoUrls: ['/old.jpg'], destination: { itineraryId: 'trip' } }
  const invalidated = []
  const writes = []
  const owned = where => where.id === item.id && where.destination.itinerary.userId === item.owner
  const prisma = { destItem: {
    findFirst: async ({ where }) => owned(where) ? structuredClone(item) : null,
    updateMany: async ({ where, data }) => {
      if (fail) throw Error('offline')
      if (concurrent || !owned(where)) return { count: 0 }
      writes.push(data)
      Object.assign(item, data)
      return { count: 1 }
    },
  } }
  const deps = { '@/auth': { auth: async () => user ? { user: { id: user } } : null }, '@/lib/prisma': { prisma }, '@/lib/eventPhotos': { eventPhotos }, 'next/cache': { revalidatePath: p => invalidated.push(p) } }
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => deps[name] })
  return { update: exports.updatePlace, item, invalidated, writes }
}

test('only the trip owner can update an event', async () => {
  for (const user of [null, 'visitor']) {
    const h = harness({ user })
    assert.ok((await h.update('event', { kind: 'rating', rating: 5 })).error)
    assert.equal(h.writes.length, 0)
  }
  const h = harness()
  assert.ok((await h.update('missing', { kind: 'rating', rating: 5 })).error)
})

test('ratings update only that field and can be cleared', async () => {
  const h = harness()
  assert.ok((await h.update('event', { kind: 'rating', rating: 5 })).success)
  assert.equal(h.item.rating, 5)
  assert.equal(h.item.notes, 'Keep my notes')
  assert.deepEqual(h.item.photoUrls, ['/old.jpg'])
  assert.deepEqual(Object.keys(h.writes[0]), ['rating'])
  await h.update('event', { kind: 'rating', rating: 0 })
  assert.equal(h.item.rating, null)
  assert.ok(h.invalidated.includes('/itinerary/trip'))
})

test('invalid ratings and photo payloads cannot mutate a place', async () => {
  const h = harness()
  for (const rating of [-1, 6, 1.5, NaN, '5', null]) assert.ok((await h.update('event', { kind: 'rating', rating })).error)
  for (const photos of [['javascript:alert(1)'], [42], null]) assert.ok((await h.update('event', { kind: 'photos', photos, expectedPhotos: ['/old.jpg'] })).error)
  assert.ok((await h.update('event', { kind: 'notes', notes: 'Unexpected edit' })).error)
  assert.equal(h.writes.length, 0)
})

test('photo updates preserve rating and notes and keep legacy cover in sync', async () => {
  const h = harness()
  assert.ok((await h.update('event', { kind: 'photos', photos: ['/old.jpg', '/new.jpg', '/new.jpg'], expectedPhotos: ['/old.jpg'] })).success)
  assert.deepEqual(Array.from(h.item.photoUrls), ['/old.jpg', '/new.jpg'])
  assert.equal(h.item.photoUrl, '/old.jpg')
  assert.equal(h.item.rating, 3)
  assert.equal(h.item.notes, 'Keep my notes')
  await h.update('event', { kind: 'photos', photos: [], expectedPhotos: ['/old.jpg', '/new.jpg'] })
  assert.equal(h.item.photoUrl, null)
  assert.equal(h.item.photoUrls.length, 0)
})

test('stale or concurrent photo changes are rejected without overwriting them', async () => {
  const h = harness()
  assert.ok((await h.update('event', { kind: 'photos', photos: ['/new.jpg'], expectedPhotos: [] })).error)
  assert.equal(h.writes.length, 0)
  const concurrent = harness({ concurrent: true })
  assert.ok((await concurrent.update('event', { kind: 'photos', photos: ['/new.jpg'], expectedPhotos: ['/old.jpg'] })).error)
  assert.equal(concurrent.item.photoUrl, '/old.jpg')
})

test('database failures return a retryable error', async () => {
  const h = harness({ fail: true })
  assert.ok((await h.update('event', { kind: 'rating', rating: 4 })).error)
  assert.equal(h.item.rating, 3)
})
