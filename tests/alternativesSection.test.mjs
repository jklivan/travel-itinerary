import assert from 'node:assert/strict'
import { test } from 'node:test'
import { partitionPlaces } from '../src/lib/placeRecommendation.ts'

test('an alternate hotel added first stays out of the main hotel list', () => {
  const eden = { id: 'eden', type: 'hotel', name: 'Eden Roc', tags: ['__option'] }
  const actual = { id: 'stay', type: 'hotel', name: 'Our hotel', tags: ['__highlight'] }
  const restaurant = { id: 'food', type: 'food_drink', tags: [] }
  const items = [eden, actual, restaurant]
  const result = partitionPlaces(items)
  assert.deepEqual(result.main, [actual, restaurant])
  assert.deepEqual(result.alternatives, [eden])
  assert.deepEqual(items, [eden, actual, restaurant])
})

test('all alternate types move together; ordinary and avoid entries retain their order', () => {
  const items = [
    { id: 'a', tags: ['__option', '__highlight'] },
    { id: 'b', tags: ['__avoid'] },
    { id: 'c' },
    { id: 'd', tags: ['__option'] },
  ]
  const result = partitionPlaces(items)
  assert.deepEqual(result.main.map(i => i.id), ['b', 'c'])
  assert.deepEqual(result.alternatives.map(i => i.id), ['a', 'd'])
})

test('an alternatives-only destination has no scheduled places', () => {
  const result = partitionPlaces([{ tags: ['__option'], dayIndex: 1 }])
  assert.equal(result.main.length, 0)
  assert.equal(result.alternatives.length, 1)
})
