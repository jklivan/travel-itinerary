import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/partialJson.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, String, parseInt, RegExp })
const { partialJsonString } = exports

test('the reply shows as it is written, before the JSON is complete', () => {
  assert.equal(partialJsonString('{"rep', 'reply'), null)
  assert.equal(partialJsonString('{"reply":"', 'reply'), '')
  assert.equal(partialJsonString('{"reply":"Comporta is gre', 'reply'), 'Comporta is gre')
  assert.equal(partialJsonString('{"reply":"Two lines\\nand \\"quotes\\" and caf\\u00e9', 'reply'), 'Two lines\nand "quotes" and café')
  // An escape cut off mid-way waits for the rest.
  assert.equal(partialJsonString('{"reply":"Line\\', 'reply'), 'Line')
  assert.equal(partialJsonString('{"reply":"caf\\u00', 'reply'), 'caf')
  // Finished field: stops at its closing quote.
  assert.equal(partialJsonString('{"reply":"Done.","recommendations":[{"name":"x"}]}', 'reply'), 'Done.')
})
