import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/repeatVisits.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports })
const { mergeRepeatVisits } = exports

test('a place visited twice shows once, with both visits’ notes, tags and photos', () => {
  const merged = mergeRepeatVisits([
    { id: 'a', type: 'activity', name: 'Bagno Fortuna', dayIndex: 1, notes: 'Great loungers', tags: ['beach'], photoUrls: ['p1'], rating: 4 },
    { id: 'b', type: 'food_drink', name: 'Da Gemma', dayIndex: 2, notes: 'Dinner' },
    { id: 'c', type: 'activity', name: 'Bagno  Fortúna', dayIndex: 4, notes: 'Went back, still great', tags: ['beach', 'kids'], photoUrls: ['p2', 'p1'], rating: 5 },
  ])
  assert.equal(merged.length, 2)
  const beach = merged.find(item => item.id === 'a')
  assert.equal(beach.notes, 'Great loungers\nWent back, still great')
  assert.deepEqual([...beach.tags], ['beach', 'kids'])
  assert.deepEqual([...beach.photoUrls], ['p1', 'p2'])
  assert.equal(beach.rating, 5)
})

test('same Google place merges even when named differently; different places with one name stay apart', () => {
  const merged = mergeRepeatVisits([
    { id: 'a', type: 'hotel', name: 'Il Pellicano', placeId: 'g1' },
    { id: 'b', type: 'hotel', name: 'Hotel Il Pellicano', placeId: 'g1', notes: 'Second stay' },
    { id: 'c', type: 'food_drink', name: 'Il Pellicano', placeId: 'g2' },
    { id: 'd', type: 'hotel', name: 'Il Pellicano' },
  ])
  assert.deepEqual([...merged.map(item => item.id)], ['a', 'c'])
  assert.equal(merged[0].notes, 'Second stay')
})
