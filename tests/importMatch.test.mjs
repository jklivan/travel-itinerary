import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeIdentity from '../src/lib/planPlaceIdentity.ts'
const lib = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/importMatch.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: lib, require: () => placeIdentity })
const { importMatch } = lib
const fourSeasons = { id: 'fs', name: 'Four Seasons Resort Punta Mita', type: 'hotel', date: null, day: 1 }

test('the same place, same kind, no conflicting day: merged without asking', () => {
  const match = importMatch([fourSeasons], { name: 'Four Seasons Resort Punta Mita', type: 'hotel', date: '2026-11-02', day: 1 })
  assert.equal(match.id, 'fs'); assert.equal(match.sure, true)
  assert.equal(importMatch([fourSeasons], { name: 'Four Seasons Punta Mita Resort', type: 'hotel', day: null }).sure, true)
})
test('unclear matches are asked about: different kind, different day or date, several candidates', () => {
  assert.equal(importMatch([fourSeasons], { name: 'Four Seasons Resort Punta Mita', type: 'food_drink' }).sure, false)
  const dinner = { id: 'd', name: 'Cafe des Artistes', type: 'food_drink', date: '2026-11-03', day: 2 }
  assert.equal(importMatch([dinner], { name: 'Cafe des Artistes', type: 'food_drink', date: '2026-11-05' }).sure, false)
  assert.equal(importMatch([dinner], { name: 'Cafe des Artistes', type: 'food_drink', day: 4 }).sure, false)
  assert.equal(importMatch([dinner, { ...dinner, id: 'd2' }], { name: 'Cafe des Artistes', type: 'food_drink' }).sure, false)
})
test('different places are not matched at all', () => {
  assert.equal(importMatch([fourSeasons], { name: 'St. Regis Punta Mita', type: 'hotel' }), null)
})
test('a booking for the same place on another day is that place (otherDayOnly), so email can merge it and ask', () => {
  const ajax = { id: 'a', name: 'Ajax Tavern', type: 'food_drink', date: null, day: 4 }
  const booking = importMatch([ajax], { name: 'Ajax Tavern', type: 'food_drink', date: '2026-12-21', day: 2 })
  assert.equal(booking.sure, false); assert.equal(booking.otherDayOnly, true)
  // Anything else unclear still isn't taken for the same place.
  assert.equal(importMatch([ajax], { name: 'Ajax Tavern', type: 'activity', day: 2 }).otherDayOnly, false)
  assert.equal(importMatch([ajax, { ...ajax, id: 'b', day: 5 }], { name: 'Ajax Tavern', type: 'food_drink', day: 2 }).otherDayOnly, false)
  assert.equal(importMatch([ajax], { name: 'Ajax Tavern', type: 'food_drink', day: 4 }).otherDayOnly, false)
})
