import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeIdentity from '../src/lib/planPlaceIdentity.ts'
const load = (path, require) => { const exports = {}; vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, require }); return exports }
const match = load('../src/lib/planDestinationMatch.ts', () => placeIdentity)
const { nextAiFold } = load('../src/lib/aiTidy.ts', name => name.includes('planPlaceIdentity') ? placeIdentity : match)

const item = (type, lat, lng, sourceKind = 'ai') => ({ type, lat, lng, sourceKind })
const stop = (id, name, order, items, country = 'Spain') => ({ id, name, country, lat: null, lng: null, order, items })

test('an AI stop near the hotel joins that stay', () => {
  const palma = stop('a', 'Palma', 0, [item('hotel', 39.57, 2.65, null)])
  const deia = stop('b', 'Deià', 1, [item('food_drink', 39.75, 2.65)])
  assert.deepEqual(Object.fromEntries(Object.entries(nextAiFold([palma, deia])).map(([k, v]) => [k, v.id])), { from: 'b', into: 'a' })
})
test('the same destination twice: the AI one joins yours', () => {
  const mine = stop('a', 'Capri, Metropolitan City of Naples', 0, [item('activity', null, null, null)], 'Italy')
  const ai = stop('b', 'Capri', 1, [item('food_drink', null, null)], 'Italy')
  const fold = nextAiFold([mine, ai]); assert.equal(fold.from.id, 'b'); assert.equal(fold.into.id, 'a')
})
test('an AI stop with only a flight joins the next real stop', () => {
  const nyc = stop('a', 'New York', 0, [item('transport', 40.64, -73.78)], 'USA')
  const rome = stop('b', 'Rome', 1, [item('hotel', 41.9, 12.5)], 'Italy')
  const fold = nextAiFold([nyc, rome]); assert.equal(fold.from.id, 'a'); assert.equal(fold.into.id, 'b')
})
test('stops you set up yourself are left for you to decide', () => {
  const palma = stop('a', 'Palma', 0, [item('hotel', 39.57, 2.65, null)])
  const deia = stop('b', 'Deià', 1, [item('food_drink', 39.75, 2.65, null), item('activity', 39.75, 2.66)])
  assert.equal(nextAiFold([palma, deia]), null)
  // Far from the hotel: a real second stop.
  assert.equal(nextAiFold([palma, stop('c', 'Madrid', 2, [item('food_drink', 40.4, -3.7)])]), null)
})
