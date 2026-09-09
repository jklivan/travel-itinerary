import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapDayNumber, mapDayColor } from '../src/lib/mapDays.ts'

test('map days preserve saved day numbers, including gaps', () => {
  assert.equal(mapDayNumber(1), 1)
  assert.equal(mapDayNumber(3), 3)
  assert.equal(mapDayNumber(0, true), 1)
  assert.equal(mapDayNumber(2, true), 3)
})

test('undated or invalid events do not get assigned a day', () => {
  for (const value of [null, undefined, -1, 1.5, NaN]) assert.equal(mapDayNumber(value), null)
})

test('day colors remain stable regardless of which days are visible', () => {
  const colors = [1, 2, 3, 4, 5, 6, 7].map(mapDayColor)
  assert.equal(new Set(colors).size, 7)
  assert.equal(mapDayColor(3), colors[2])
  assert.notEqual(mapDayColor(null), colors[0])
  assert.match(mapDayColor(25), /^hsl\(/)
})
