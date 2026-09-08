import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { reorderItems } from '../src/lib/reorderItems.ts'

// Exercise the editor's real load/save conversion without mounting its UI.
const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/app/itinerary/[id]/edit/EditForm.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source + '\nexport { destFromRaw, buildDestinations };', {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText
const context = { exports: {}, require: name => name.startsWith('@/') ? {} : require(name) }
vm.runInNewContext(compiled, context)
const { destFromRaw, buildDestinations } = context.exports

const raw = { name: 'London', country: 'UK', notes: '', items: [
  { type: 'food_drink', name: 'Breakfast', dayIndex: 1, order: 0 },
  { type: 'activity', name: 'Walk', dayIndex: 1, order: 1 },
  { type: 'food_drink', name: 'Dinner', dayIndex: 1, order: 2 },
  { type: 'activity', name: 'Museum', dayIndex: 2, order: 0 },
] }
const namesOnDay = (dest, day) => Array.from(dest.items.filter(item => item.dayIndex === day), item => item.name)

function saveAndReopen(dest) {
  const saved = buildDestinations([dest])[0]
  const rows = saved.groups.flatMap((group, groupIndex) => group.days.flatMap(day => [
    ...day.food.map(item => ({ ...item, type: 'food_drink', dayIndex: day.dayIndex, groupIndex })),
    ...day.activities.map(item => ({ ...item, type: 'activity', dayIndex: day.dayIndex, groupIndex })),
  ]))
  return destFromRaw({ ...raw, items: rows })
}

test('mixed restaurant/activity reorder changes immediately and survives repeated saves', () => {
  const initial = destFromRaw(raw)
  const walk = initial.items.find(item => item.name === 'Walk')
  const breakfast = initial.items.find(item => item.name === 'Breakfast')
  let dest = { ...initial, items: reorderItems(initial.items, walk.id, breakfast.id, 1) }
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(namesOnDay(dest, 1), ['Walk', 'Breakfast', 'Dinner'])
    assert.deepEqual(namesOnDay(dest, 2), ['Museum'])
    dest = saveAndReopen(dest)
  }
})

test('legacy zero-based days normalize once without shifting on subsequent edits', () => {
  const initial = destFromRaw({ ...raw, items: raw.items.map(item => ({ ...item, dayIndex: item.dayIndex - 1 })) })
  const reopened = saveAndReopen(initial)
  for (const dest of [initial, reopened]) {
    assert.deepEqual(namesOnDay(dest, 1), ['Breakfast', 'Walk', 'Dinner'])
    assert.deepEqual(namesOnDay(dest, 2), ['Museum'])
  }
})
