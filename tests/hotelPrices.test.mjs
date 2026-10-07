import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Loads src/lib/hotelPrices.ts with a fake LiteAPI key and a fetch that must not be called.
function load() {
  const exports = {}
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/hotelPrices.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const fetch = () => { throw new Error('should not look up prices') }
  vm.runInNewContext(code, { exports, require: () => ({}), process: { env: { LITEAPI_KEY: 'test' } }, fetch, AbortSignal, URLSearchParams, Date, JSON, Math, Number, Array, Set, Map, Promise })
  return exports
}

test('past dates are refused before any price lookup, so they never read as sold out', async () => {
  const { runHotelPrices } = load()
  const result = await runHotelPrices({ city: 'Lucerne', country_code: 'CH', checkin: '2020-06-12', checkout: '2020-06-14', rooms: [{ adults: 2 }] })
  assert.equal(result.isError, true)
  assert.match(result.content, /in the past/)
})
