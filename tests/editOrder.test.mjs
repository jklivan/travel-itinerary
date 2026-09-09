import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { moveItemToDay, reorderItems } from '../src/lib/reorderItems.ts'
import * as recommendations from '../src/lib/placeRecommendation.ts'

// Exercise the editor's real load/save conversion without mounting its UI.
const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/app/itinerary/[id]/edit/EditForm.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source + '\nexport { destFromRaw, buildDestinations };', {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText
const context = { exports: {}, require: name => name === '@/lib/placeRecommendation' ? recommendations : name.startsWith('@/') ? {} : require(name) }
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


test('cross-day moves survive saving without pulling other events into earlier days', () => {
  const initial = destFromRaw(raw)
  const breakfast = initial.items.find(item => item.name === 'Breakfast')
  const moved = { ...initial, items: moveItemToDay(initial.items, breakfast.id, 3) }
  for (const dest of [moved, saveAndReopen(moved)]) {
    assert.deepEqual(namesOnDay(dest, 1), ['Walk', 'Dinner'])
    assert.deepEqual(namesOnDay(dest, 2), ['Museum'])
    assert.deepEqual(namesOnDay(dest, 3), ['Breakfast'])
  }
})

test('event photos load and serialize for hotels, restaurants, and activities', () => {
  const initial = destFromRaw({ ...raw, items: [
    { type: 'hotel', name: 'Hotel', photoUrl: '/hotel.jpg', groupIndex: 0 },
    { type: 'food_drink', name: 'Cafe', photoUrl: '/cafe.jpg', dayIndex: 1, groupIndex: 0 },
    { type: 'activity', name: 'Tour', photoUrl: '/tour.jpg', dayIndex: 1, groupIndex: 0 },
  ] })
  assert.deepEqual(Array.from(initial.items, item => item.photo), ['/hotel.jpg', '/cafe.jpg', '/tour.jpg'])
  let saved = buildDestinations([initial])[0].groups[0]
  assert.equal(saved.hotelPhoto, '/hotel.jpg')
  assert.equal(saved.days[0].food[0].photo, '/cafe.jpg')
  assert.equal(saved.days[0].activities[0].photo, '/tour.jpg')
  const updated = { ...initial, items: initial.items.map(item => ({ ...item, photo: item.type === 'activity' ? '' : '/replacement.jpg' })) }
  saved = buildDestinations([updated])[0].groups[0]
  assert.equal(saved.hotelPhoto, '/replacement.jpg')
  assert.equal(saved.days[0].food[0].photo, '/replacement.jpg')
  assert.equal(saved.days[0].activities[0].photo, '')
})


test('must-stay and avoid markers survive editing and keep other tags', () => {
  for (const marker of ['__highlight', '__avoid']) {
    const initial = destFromRaw({ ...raw, items: [
      { type: 'hotel', name: 'Hotel', tags: ['Boutique', marker], groupIndex: 0 },
      { type: 'food_drink', name: 'Cafe', tags: ['Local Favorite', marker], dayIndex: 1, groupIndex: 0 },
      { type: 'activity', name: 'Tour', tags: ['Cultural', marker], dayIndex: 1, groupIndex: 0 },
    ] })
    const saved = buildDestinations([initial])[0].groups[0]
    assert.deepEqual(Array.from(saved.hotelTags), ['Boutique', marker])
    assert.deepEqual(Array.from(saved.days[0].food[0].tags), ['Local Favorite', marker])
    assert.deepEqual(Array.from(saved.days[0].activities[0].tags), ['Cultural', marker])
    assert.equal(initial.items[0].isHighlight, marker === '__highlight')
  }
})
