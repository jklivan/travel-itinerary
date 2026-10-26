import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openAt, hoursOn, dayName } from '../src/lib/planner/hours.ts'

// A restaurant open Tue–Sat for lunch 12–15 and dinner 19–23:30 (Saturday dinner till 01:00 Sunday). 2026-11-03 is a Tuesday.
const p = (day, h, m) => ({ day, hour: h, minute: m })
const restaurant = [2, 3, 4, 5, 6].flatMap(day => [{ open: p(day, 12, 0), close: p(day, 15, 0) }, { open: p(day, 19, 0), close: day === 6 ? p(0, 1, 0) : p(day, 23, 30) }])

test('open at a time, and the hours for a day', () => {
  assert.equal(dayName('2026-11-03'), 'Tuesday')
  assert.equal(openAt(restaurant, '2026-11-03', '13:00'), true)
  assert.equal(openAt(restaurant, '2026-11-03', '16:00'), false)
  assert.equal(hoursOn(restaurant, '2026-11-03'), '12:00–15:00, 19:00–23:30')
  assert.equal(hoursOn(restaurant, '2026-11-02'), null) // Monday: closed
})
test('late nights past midnight, and places open around the clock', () => {
  assert.equal(openAt(restaurant, '2026-11-08', '00:30'), true) // Sunday 00:30, still Saturday's dinner
  assert.equal(hoursOn(restaurant, '2026-11-07'), '12:00–15:00, 19:00–01:00')
  const always = [{ open: p(0, 0, 0) }]
  assert.equal(openAt(always, '2026-11-03', '04:00'), true)
  assert.equal(hoursOn(always, '2026-11-03'), 'Open 24 hours')
})
