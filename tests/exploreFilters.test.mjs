import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { TAGS } from '../src/lib/tags.ts'

const exports = {}
const code = ts.transpileModule(readFileSync(new URL('../src/lib/exploreFilters.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
vm.runInNewContext(code, { exports, require: name => { assert.equal(name, './tags'); return { TAGS } } })
const { parseExploreFilters, exploreFilterWhere } = exports
const plain = value => JSON.parse(JSON.stringify(value))

test('multiple trip types and vibes survive URL parsing, without duplicates or unknown filters', () => {
  assert.deepEqual(plain(parseExploreFilters('family,friends,family,unknown', 'beach,food,beach,unknown')), { types: ['family', 'friends'], tags: ['beach', 'food'] })
})

test('results match any chosen audience and any chosen vibe together', () => {
  const where = exploreFilterWhere(parseExploreFilters('romantic,friends', 'beach,luxury'))
  assert.deepEqual(plain(where), { audience: { in: ['romantic', 'friends'] }, tags: { hasSome: ['beach', 'luxury'] } })
})

test('clearing filters removes restrictions; selecting only one group does not restrict the other', () => {
  assert.deepEqual(plain(exploreFilterWhere(parseExploreFilters())), {})
  assert.deepEqual(plain(exploreFilterWhere(parseExploreFilters('family'))), { audience: { in: ['family'] } })
  assert.deepEqual(plain(exploreFilterWhere(parseExploreFilters(undefined, 'beach'))), { tags: { hasSome: ['beach'] } })
})
