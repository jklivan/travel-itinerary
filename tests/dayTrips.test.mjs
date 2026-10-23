import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDayTrip, tripDuration } from '../src/lib/dayTrips.ts'
const trip = { tags: [], postType: 'itinerary', datesFlexible: false, startDate: new Date('2026-09-17'), endDate: new Date('2026-09-17') }
test('day trips include same-day and overnight trips, excluding longer or reversed dates', () => {
  // One day only for a trip posted as a day trip; overnight trips count either way.
  assert.equal(isDayTrip({ ...trip, postType: 'day-trip' }), true)
  assert.equal(isDayTrip(trip), false)
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

test('a multi-day schedule overrides a one-day fallback or explicit day-trip tag', () => {
  const destinations = [{ items: [{ type: 'activity', dayIndex: 1 }, { type: 'activity', dayIndex: 5 }] }]
  assert.equal(isDayTrip({ ...trip, destinations }), false)
  assert.equal(isDayTrip({ ...trip, destinations, datesFlexible: true, tags: ['day-trip'] }), false)
})

test('missing dates are not one day; explicit duration works without calendar dates', async () => {
  const placeholder = { ...trip, startDate: new Date('2026-09-17T12:34:56Z'), endDate: new Date('2026-09-17T12:34:56Z') }
  assert.equal(tripDuration(placeholder), null)
  assert.equal(tripDuration({ ...placeholder, durationDays: 4 }), 4)
  assert.equal(isDayTrip({ ...placeholder, durationDays: 4 }), false)
  assert.equal(tripDuration({ ...trip, datesFlexible: true, durationDays: 1, postType: 'day-trip' }), 1)
  assert.equal(tripDuration({ ...placeholder, destinations: [{ items: [{ type: 'activity', dayIndex: 0 }, { type: 'activity', dayIndex: 2 }] }] }), 3)
  assert.equal(tripDuration({ ...placeholder, postType: 'guide', destinations: [{ items: [{ type: 'activity', dayIndex: 1 }] }] }), null)
})

test('a trip that is not a day trip never shows as one day', () => {
  const base = { postType: 'itinerary', datesFlexible: true, startDate: new Date('2000-01-01T00:00:00Z'), endDate: new Date('2000-01-01T00:00:00Z'), tags: [] }
  // Everything put on Day 1 of a long weekend.
  assert.equal(tripDuration({ ...base, destinations: [{ items: [{ type: 'activity', dayIndex: 1 }, { type: 'food_drink', dayIndex: 1 }] }] }), null)
  // A leftover single date or length of one.
  assert.equal(tripDuration({ ...base, datesFlexible: false, startDate: new Date('2025-05-01T00:00:00Z'), endDate: new Date('2025-05-01T00:00:00Z') }), null)
  assert.equal(tripDuration({ ...base, durationDays: 1 }), null)
  // Real day trips still say one day; longer trips are unchanged.
  assert.equal(tripDuration({ ...base, postType: 'day-trip', durationDays: 1 }), 1)
  assert.equal(tripDuration({ ...base, tags: ['day-trip'] }), 1)
  assert.equal(tripDuration({ ...base, destinations: [{ items: [{ type: 'activity', dayIndex: 1 }, { type: 'activity', dayIndex: 3 }] }] }), 3)
})
