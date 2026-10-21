import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Loads lib/placeStatus with a fake Google that answers with the given places.
function load(places) {
  const exports = {}
  const placePhoto = { matchesPlace: (name, city, candidate) => (candidate.displayName?.text ?? '').toLowerCase() === name.toLowerCase() && (candidate.formattedAddress ?? '').toLowerCase().includes(city.toLowerCase()) }
  const fetch = async () => ({ ok: true, json: async () => ({ places }) })
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/placeStatus.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, fetch, AbortSignal, JSON, process: { env: { GOOGLE_PLACES_API_KEY: 'key' } }, require: () => placePhoto })
  return exports.placeStatus
}
const at = (name, status) => ({ id: 'x', displayName: { text: name }, formattedAddress: `Rua 1, Lisbon, Portugal`, businessStatus: status })

test('a place Google lists as closed (for good or for now) is closed; open is operating', async () => {
  assert.equal(await load([at('Old Hotel', 'CLOSED_PERMANENTLY')])({ name: 'Old Hotel', city: 'Lisbon' }), 'closed')
  assert.equal(await load([at('Old Hotel', 'CLOSED_TEMPORARILY')])({ name: 'Old Hotel', city: 'Lisbon' }), 'closed')
  assert.equal(await load([at('Belcanto', 'OPERATIONAL')])({ name: 'Belcanto', city: 'Lisbon' }), 'operating')
})
test('a different place, no match or no status is unknown, so the pick is kept', async () => {
  assert.equal(await load([at('Some Other Hotel', 'CLOSED_PERMANENTLY')])({ name: 'Old Hotel', city: 'Lisbon' }), 'unknown')
  assert.equal(await load([])({ name: 'Old Hotel', city: 'Lisbon' }), 'unknown')
  assert.equal(await load([{ ...at('Old Hotel'), businessStatus: undefined }])({ name: 'Old Hotel', city: 'Lisbon' }), 'unknown')
})
test('a renamed place (one result, same kind, same town) shows under its new name; several results are unknown', async () => {
  const capVermell = { id: 'cv', displayName: { text: 'Cap Vermell Grand Hotel' }, formattedAddress: 'Vial A, 12, 07589 Canyamel Platja, Spain', businessStatus: 'OPERATIONAL', types: ['hotel', 'lodging'] }
  assert.equal(JSON.stringify(await load([capVermell])({ name: 'Park Hyatt Mallorca', city: 'Canyamel', type: 'hotel' })), JSON.stringify({ renamed: 'Cap Vermell Grand Hotel', placeId: 'cv' }))
  assert.equal(await load([capVermell, { ...capVermell, id: 'b', displayName: { text: 'Hostal Boutique' } }])({ name: 'Park Hyatt Mallorca', city: 'Canyamel', type: 'hotel' }), 'unknown')
  assert.equal(await load([{ ...capVermell, types: ['restaurant'] }])({ name: 'Park Hyatt Mallorca', city: 'Canyamel', type: 'hotel' }), 'unknown')
})
