import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeIdentity from '../src/lib/planPlaceIdentity.ts'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/tripLocation.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => placeIdentity })
const { tripLocationLabel } = exports

test('one place is written out; more show the first place and "& more…"', () => {
  assert.equal(tripLocationLabel([{ name: 'Nantucket', country: 'United States' }]), 'Nantucket, United States')
  assert.equal(tripLocationLabel([{ name: 'Antibes', country: 'France' }, { name: 'Provence', country: 'France' }]), 'Antibes, France & more…')
  assert.equal(tripLocationLabel([]), null)
})
test('the same town saved twice counts once, and the planner placeholder is skipped', () => {
  assert.equal(tripLocationLabel([{ name: 'Antibes', country: 'France' }, { name: 'Antibes', country: 'France' }]), 'Antibes, France')
  assert.equal(tripLocationLabel([{ name: 'Destination to decide' }, { name: 'Los Olivos, CA, USA', country: null }]), 'Los Olivos, CA, USA')
  assert.equal(tripLocationLabel([{ name: 'Antibes, France', country: null }, { name: 'Antibes', country: 'France' }, { name: 'Provence', country: 'France' }]), 'Antibes, France & more…')
})

test('a venue saved as a destination shows as its town', () => {
  const towns = d => exports.destinationTown(d)
  assert.equal(towns({ name: 'Gettó Gulyás, Budapest, Wesselényi Street', country: 'Hungary' }), 'Budapest, Hungary')
  assert.equal(towns({ name: 'Story of Soil', country: 'San Marcos Avenue, Los Olivos, CA, USA' }), 'Los Olivos, CA, USA')
  assert.equal(towns({ name: 'Brave & Maiden Estate', country: 'North Refugio Road, Santa Ynez, CA, USA' }), 'Santa Ynez, CA, USA')
  assert.equal(towns({ name: 'Róma Ételbár, Budapest, Csalogány utca, Hungary', country: null }), 'Budapest, Hungary')
  // Towns stay as they are, including ones whose state code looks like a street abbreviation.
  assert.equal(towns({ name: 'New Milford', country: 'CT, USA' }), 'New Milford, CT, USA')
  assert.equal(towns({ name: 'Los Olivos, CA, USA', country: null }), 'Los Olivos, CA, USA')
  assert.equal(towns({ name: 'Positano, SA, Italy', country: null }), 'Positano, SA, Italy')
  // Two restaurants in the same town are one place.
  assert.equal(tripLocationLabel([{ name: 'Gettó Gulyás, Budapest, Wesselényi Street', country: 'Hungary' }, { name: 'Róma Ételbár, Budapest, Csalogány utca, Hungary', country: null }]), 'Budapest, Hungary')
  assert.equal(tripLocationLabel([{ name: 'Los Olivos, CA, USA' }, { name: 'Story of Soil', country: 'San Marcos Avenue, Los Olivos, CA, USA' }, { name: 'Brave & Maiden Estate', country: 'North Refugio Road, Santa Ynez, CA, USA' }]), 'Los Olivos, CA, USA & more…')
})
