import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeIdentity from '../src/lib/planPlaceIdentity.ts'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/planDestinationMatch.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => placeIdentity })
const { planDestinationFor } = exports

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
