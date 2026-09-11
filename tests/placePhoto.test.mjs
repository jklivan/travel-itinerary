import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findPlacePhoto, matchesPlace } from '../src/lib/placePhoto.ts'
const candidate = { id: 'nobu', displayName: { text: 'Nobu Hotel Ibiza Bay' }, formattedAddress: 'Ibiza, Spain', photos: [{ name: 'places/nobu/photos/image', authorAttributions: [{ displayName: 'Photographer', uri: 'https://example.com/author' }] }] }

test('matching rejects wrong cities, mismatched names and vague partial matches', () => {
  assert.equal(matchesPlace('Nobu Ibiza Bay', 'Ibiza', candidate), true)
  assert.equal(matchesPlace('Nobu Ibiza Bay', 'Ibiza', { ...candidate, formattedAddress: 'Carrer de Ses Feixes, 52, Eivissa, Spain' }), true)
  assert.equal(matchesPlace('Nobu Ibiza Bay', 'London', candidate), false)
  assert.equal(matchesPlace('Other Hotel', 'Ibiza', candidate), false)
  assert.equal(matchesPlace('Nobu', 'Ibiza', candidate), false)
})

test('photo lookup keeps author attribution, uses no-store and never returns the API key', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options])
    return Response.json(String(url).includes('/media?') ? { photoUri: 'https://lh3.googleusercontent.com/photo' } : candidate)
  }
  try {
    const photo = await findPlacePhoto({ name: 'Nobu Ibiza Bay', city: 'Ibiza', placeId: 'nobu' }, 'test-secret')
    assert.equal(photo.authors[0].displayName, 'Photographer')
    assert.equal(photo.authors[0].uri, 'https://example.com/author')
    assert.ok(calls.every(([, options]) => options.cache === 'no-store'))
    assert.equal(JSON.stringify(photo).includes('test-secret'), false)
    assert.equal(calls.length, 2)
  } finally { globalThis.fetch = original }
})

test('ambiguous results and unavailable photos keep the placeholder', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ places: [candidate, candidate] })
    assert.equal(await findPlacePhoto({ name: 'Nobu Ibiza Bay', city: 'Ibiza' }, 'key'), null)
    globalThis.fetch = async () => Response.json({ id: 'nobu', photos: [] })
    assert.equal(await findPlacePhoto({ name: 'Nobu', city: 'Ibiza', placeId: 'nobu' }, 'key'), null)
    globalThis.fetch = async () => { throw Error('offline') }
    assert.equal(await findPlacePhoto({ name: 'Nobu', city: 'Ibiza', placeId: 'nobu' }, 'key'), null)
  } finally { globalThis.fetch = original }
})

test('photo endpoint skips uploads and denies another user’s unpublished trip', async () => {
  const { readFileSync } = await import('node:fs')
  const { default: vm } = await import('node:vm')
  const { default: ts } = await import('typescript')
  const code = ts.transpileModule(readFileSync(new URL('../src/app/api/place-photo/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  for (const scenario of ['uploaded', 'private', 'public']) {
    let lookups = 0
    const context = { exports: {}, Response, process: { env: { GOOGLE_PLACES_API_KEY: 'key' } }, require: name => {
      if (name === '@/lib/prisma') return { prisma: { destItem: { findUnique: async () => ({ name: 'Hotel', photoUrls: scenario === 'uploaded' ? ['/mine.jpg'] : [], destination: { name: 'Ibiza', itinerary: { visibility: scenario === 'private' ? 'draft' : 'public', userId: 'owner' } } }) } } }
      if (name === '@/auth') return { auth: async () => null }
      if (name === '@/lib/eventPhotos') return { eventPhotos: (photos) => photos }
      if (name === '@/lib/placePhoto') return { findPlacePhoto: async () => { lookups++; return null } }
      return {}
    } }
    vm.runInNewContext(code, context)
    const response = await context.exports.GET({ nextUrl: new URL('http://localhost/api/place-photo?item=hotel') })
    assert.equal(lookups, scenario === 'public' ? 1 : 0)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  }
})
