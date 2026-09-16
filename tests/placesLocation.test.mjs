import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source = readFileSync(new URL('../src/app/api/places/route.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function harness({ details, failFirst = false } = {}) {
  const calls = []
  const exports = {}
  vm.runInNewContext(code, { exports, Response, console, process: { env: { GOOGLE_PLACES_API_KEY: 'test-key' } }, require: () => ({}), fetch: async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null
    calls.push({ url, body })
    if (body?.includedPrimaryTypes?.includes('(regions)')) {
      if (failFirst && calls.length === 1) return Response.json({}, { status: 503 })
      return Response.json({ suggestions: [{ placePrediction: { placeId: 'city-id' } }] })
    }
    if (url.endsWith('/city-id')) return Response.json(details ?? { types: ['locality'], location: { latitude: 41.9028, longitude: 12.4964 } })
    return Response.json({ suggestions: [{ placePrediction: { placeId: 'place-id', structuredFormat: { mainText: { text: 'Selected place' }, secondaryText: { text: 'Rome, Italy' } } } }] })
  } })
  return { calls, get: query => exports.GET({ nextUrl: new URL(`https://test.invalid/api/places?${query}`) }) }
}
test('hotel, restaurant and activity searches inject destination coordinates and preserve place identity', async () => {
  for (const type of ['hotel', 'restaurant', 'activity']) {
    const h = harness()
    const response = await h.get(`q=hotel&type=${type}&city=Rome%2C+Italy`)
    assert.equal(h.calls[0].body.input, 'Rome, Italy')
    const searches = h.calls.filter(c => c.body?.input === 'hotel')
    assert.ok(searches.length)
    for (const call of searches) {
      assert.equal(call.body.locationRestriction.circle.radius, 50000)
      assert.equal(call.body.locationRestriction.circle.center.latitude, 41.9028)
      assert.equal(call.body.locationBias, undefined)
    }
    assert.equal((await response.json())[0].placeId, 'place-id')
    await h.get(`q=cafe&type=${type}&city=Rome%2C+Italy`)
    assert.equal(h.calls.filter(c => c.url.endsWith('/city-id')).length, 1, 'city coordinates are cached')
  }
})
test('destination search remains available before a city has been selected', async () => {
  const h = harness(); await h.get('q=Rome&type=destination')
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].body.locationBias, undefined)
})


test('Switzerland uses the entire country, not a small central circle or worldwide search', async () => {
  for (const type of ['hotel', 'restaurant', 'activity', 'all']) {
    const h = harness({ details: { types: ['country', 'political'], location: { latitude: 46.8, longitude: 8.2 }, addressComponents: [{ types: ['country'], shortText: 'CH' }] } })
    const response = await h.get(`q=four+season&type=${type}&city=Switzerland`)
    assert.equal(response.status, 200)
    const searches = h.calls.filter(c => c.body?.input === 'four season')
    assert.ok(searches.length)
    for (const search of searches) {
      assert.deepEqual(search.body.includedRegionCodes, ['ch'])
      assert.equal(search.body.locationBias, undefined)
      assert.equal(search.body.locationRestriction, undefined)
    }
  }
})
test('administrative regions use their bounds rather than a city-sized circle', async () => {
  const viewport = { low: { latitude: 43, longitude: 9 }, high: { latitude: 45, longitude: 12 } }
  const h = harness({ details: { types: ['administrative_area_level_1'], viewport } })
  await h.get('q=hotel&type=hotel&city=Tuscany')
  for (const call of h.calls.filter(c => c.body?.input === 'hotel')) assert.deepEqual(call.body.locationRestriction.rectangle, viewport)
})
test('failed destination lookup does not search worldwide and can recover on retry', async () => {
  const h = harness({ failFirst: true })
  assert.equal((await h.get('q=four+season&type=hotel&city=Switzerland')).status, 503)
  assert.equal(h.calls.length, 1)
  assert.equal((await h.get('q=four+season&type=hotel&city=Switzerland')).status, 200)
})
test('missing country code or unusable coordinates fail closed', async () => {
  for (const details of [{ types: ['country'], location: { latitude: 46.8, longitude: 8.2 } }, { types: ['locality'], location: { latitude: 900, longitude: 8 } }]) {
    const h = harness({ details })
    assert.equal((await h.get('q=hotel&type=hotel&city=Switzerland')).status, 503)
    assert.equal(h.calls.filter(c => c.body?.input === 'hotel').length, 0)
  }
})
