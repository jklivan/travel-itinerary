import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reorderItems } from '../src/lib/reorderItems.ts'

const items = [
  { id: 'breakfast', dayIndex: 1 },
  { id: 'museum', dayIndex: 2 },
  { id: 'walk', dayIndex: 1 },
  { id: 'dinner', dayIndex: 2 },
]

test('reorders within a day without changing other days or the original items', () => {
  const result = reorderItems(items, 'walk', 'breakfast', 1)
  assert.deepEqual(result.map(item => item.id), ['walk', 'museum', 'breakfast', 'dinner'])
  assert.equal(result[1], items[1])
  assert.equal(result[3], items[3])
  assert.deepEqual(items.map(item => item.id), ['breakfast', 'museum', 'walk', 'dinner'])
  assert.deepEqual(result.filter(item => item.dayIndex === 1).map(item => item.id), ['walk', 'breakfast'])
  assert.deepEqual(reorderItems(result, 'walk', 'breakfast', 1), items)
})

test('ignores drops on a different day in either direction', () => {
  assert.equal(reorderItems(items, 'walk', 'museum', 1), items)
  assert.equal(reorderItems(items, 'museum', 'breakfast', 2), items)
  assert.equal(reorderItems(items, 'museum', 'dinner', 1), items)
})

test('ignores missing targets, self drops, and empty lists', () => {
  assert.equal(reorderItems(items, 'walk', 'missing', 1), items)
  assert.equal(reorderItems(items, 'missing', 'walk', 1), items)
  assert.equal(reorderItems(items, 'walk', 'walk', 1), items)
  assert.deepEqual(reorderItems([], 'walk', 'breakfast', 1), [])
})

test('guides can still reorder their flat list without a day restriction', () => {
  assert.deepEqual(reorderItems(items, 'dinner', 'breakfast').map(item => item.id), [
    'dinner', 'breakfast', 'museum', 'walk',
  ])
})
