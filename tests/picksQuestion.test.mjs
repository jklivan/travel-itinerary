import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/travelPreferences.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports })
const base = { travelers: '', length: '', budget: null, destinationTypes: [], activities: [] }
const date = value => ({ '2026-08-12': 'Wed, Aug 12', '2026-08-15': 'Sat, Aug 15' })[value]

test('the start page says its choices in words as the question', () => {
  assert.equal(exports.picksQuestion({ ...base, distance: 'Up to 2 hours' }, date), 'Show me trip ideas within 2 hours.')
  assert.equal(exports.picksQuestion({ ...base, distance: 'Up to 2 hours', from: 'Greenwich', when: 'This weekend', travelers: 'Couple', vibes: ['Relaxing', 'Beach'], friends: ['Jennifer Rosenthal'] }, date),
    'Show me trip ideas within 2 hours of Greenwich for this weekend, for a couple, with a relaxing, beach vibe, using places Jennifer loved.')
  assert.equal(exports.picksQuestion({ ...base, when: 'Specific dates', startDate: '2026-08-12', endDate: '2026-08-15', distance: 'A short flight', from: 'New York' }, date),
    'Show me trip ideas a short flight away from New York for Wed, Aug 12 – Sat, Aug 15.')
  assert.equal(exports.picksQuestion({ ...base, travelers: 'Couple', vibes: ['Beach'], budget: 2 }, date), 'Show me trip ideas for a couple, with a beach vibe, $$ mid-range.')
})
