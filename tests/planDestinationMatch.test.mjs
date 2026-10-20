import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeIdentity from '../src/lib/planPlaceIdentity.ts'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/planDestinationMatch.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => placeIdentity })
const { planDestinationFor, stayLookAlikes } = exports

const ischia = { name: 'Ischia', country: 'Metropolitan City of Naples, Italy', lat: 40.73, lng: 13.9, items: [] }
const capri = { name: 'Capri', country: 'Italy', lat: 40.55, lng: 14.24, items: [] }

test('a place from a more specific town joins your broader destination', () => {
  // Named: "Barano d'Ischia" contains Ischia.
  assert.equal(planDestinationFor([ischia, capri], { destination: { name: "Barano d'Ischia", country: 'Italy' } }), ischia)
  // Nearby by map position, even when the town name doesn't say so (Fiaiano is on Ischia).
  assert.equal(planDestinationFor([ischia, capri], { destination: { name: 'Fiaiano', country: 'Italy' }, lat: 40.72, lng: 13.89 }), ischia)
  // Its address names the destination.
  assert.equal(planDestinationFor([capri, ischia], { destination: { name: 'Lacco Ameno', country: 'Italy' }, address: 'Via Roma 1, 80076 Ischia NA, Italy' }), ischia)
})
test('a place somewhere else still gets its own destination', () => {
  assert.equal(planDestinationFor([ischia], { destination: { name: 'Ravello', country: 'Italy' }, lat: 40.65, lng: 14.61 }), undefined)
  assert.equal(planDestinationFor([ischia], { destination: { name: 'Paris', country: 'France' } }), undefined)
  // Same name in a different country is not a match.
  assert.equal(planDestinationFor([{ name: 'Florence', country: 'Italy', lat: null, lng: null }], { destination: { name: 'Florence', country: 'SC, USA' } }), undefined)
})
test('the same destination still matches as before, and the placeholder is never used', () => {
  assert.equal(planDestinationFor([ischia], { destination: { name: 'Ischia', country: 'Italy' } }), ischia)
  assert.equal(planDestinationFor([{ name: 'Destination to decide', country: null, lat: null, lng: null }], { destination: { name: 'Ischia', country: 'Italy' } }), undefined)
})

// Same hotel, same destination: a place that isn't a hotel joins the stay whose hotel is within 100 km, even when
// Google names a different town for it; a new hotel far away still starts its own destination.
const nassau = { id: 'nassau', name: 'Nassau', country: 'Bahamas', lat: null, lng: null, items: [{ type: 'hotel', lat: 25.075, lng: -77.405 }] }
test('a place near your hotel stays with that destination', () => {
  // A restaurant 45 km away, in a town Google calls something else: joins Nassau, where the hotel is.
  assert.equal(planDestinationFor([nassau], { type: 'food_drink', destination: { name: 'Coral Harbour', country: 'Bahamas' }, lat: 24.98, lng: -77.0 }), nassau)
  // A new hotel there would start its own destination.
  assert.equal(planDestinationFor([nassau], { type: 'hotel', destination: { name: 'Coral Harbour', country: 'Bahamas' }, lat: 24.98, lng: -77.0 }), undefined)
  // Far from any hotel (Exuma, ~200 km): its own destination.
  assert.equal(planDestinationFor([nassau], { type: 'activity', destination: { name: 'Great Exuma', country: 'Bahamas' }, lat: 23.5, lng: -75.8 }), undefined)
})
test('a destination with no hotel, around another one\'s hotel, is offered for merging', () => {
  const paradise = { id: 'paradise', name: 'Paradise Island', country: 'Bahamas', lat: null, lng: null, items: [{ type: 'food_drink', lat: 25.085, lng: -77.32 }] }
  const exuma = { id: 'exuma', name: 'Great Exuma', country: 'Bahamas', lat: null, lng: null, items: [{ type: 'activity', lat: 23.5, lng: -75.8 }] }
  const pairs = stayLookAlikes([nassau, paradise, exuma])
  assert.equal(JSON.stringify(pairs.map(pair => [pair.keep.id, pair.other.id])), JSON.stringify([['nassau', 'paradise']]))
})
