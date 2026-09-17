import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDayTrip } from '../src/lib/dayTrips.ts'
const trip = { tags: [], postType: 'itinerary', datesFlexible: false, startDate: new Date('2026-09-17'), endDate: new Date('2026-09-17') }
test('day trips include same-day and overnight trips, excluding longer or reversed dates', () => {
  assert.equal(isDayTrip(trip), true)
  assert.equal(isDayTrip({ ...trip, endDate: new Date('2026-09-18') }), true)
  assert.equal(isDayTrip({ ...trip, endDate: new Date('2026-09-19') }), false)
  assert.equal(isDayTrip({ ...trip, tags: ['day-trip'], endDate: new Date('2026-09-19') }), false)
  assert.equal(isDayTrip({ ...trip, endDate: new Date('2026-09-16') }), false)
})
test('guides and flexible plans are not inferred from placeholder dates', () => {
  for (const overrides of [{ postType: 'guide' }, { datesFlexible: true }]) {
    assert.equal(isDayTrip({ ...trip, ...overrides }), false)
    assert.equal(isDayTrip({ ...trip, ...overrides, tags: ['day-trip'] }), true)
  }
})
