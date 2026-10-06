import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/locatePlaces.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: () => ({ prisma: {} }), process })
const { needsLocating } = exports
const place = (name, lat, lng, type = 'activity') => ({ name, type, lat, lng })

test('a trip needs locating when a place has no spot, or one pin is far from the rest', () => {
  const amalfi = [place('Il Focolare', 40.735, 13.92), place('Boat day', 40.74, 13.94), place('Rossellinis', 40.651, 14.613), place('Il Carlino', 40.623, 14.504)]
  assert.equal(needsLocating(amalfi), false)
  assert.equal(needsLocating([...amalfi, place('Mezzatorre', null, null, 'hotel')]), true)
  // Hotel Caruso found in Rimini, not Ravello.
  assert.equal(needsLocating([...amalfi, place('Hotel Caruso', 44.04, 12.6, 'hotel')]), true)
  // Transport without a spot doesn't count.
  assert.equal(needsLocating([...amalfi, place('Ferry', null, null, 'transport')]), false)
  // A trip spread across countries (no tight cluster) isn't flagged.
  assert.equal(needsLocating([place('Paris', 48.85, 2.35), place('Rome', 41.9, 12.5), place('Lisbon', 38.72, -9.14), place('Berlin', 52.52, 13.4)]), false)
})

test('a place found under a longer Google name still counts as the same place', () => {
  const { sameName } = exports
  assert.equal(sameName('Caruso, A Belmond Hotel, Amalfi Coast', 'Hotel Caruso'), true)
  assert.equal(sameName('Mezzatorre Hotel & Thermal Spa', 'Mezzatorre'), true)
  assert.equal(sameName('Hotel Santa Caterina', 'Hotel Caruso'), false)
  assert.equal(sameName('Da Adolfo', 'Il Focolare'), false)
})
