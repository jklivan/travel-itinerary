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

test('a multi-day schedule overrides a one-day fallback or explicit day-trip tag', () => {
  const destinations = [{ items: [{ type: 'activity', dayIndex: 1 }, { type: 'activity', dayIndex: 5 }] }]
  assert.equal(isDayTrip({ ...trip, destinations }), false)
  assert.equal(isDayTrip({ ...trip, destinations, datesFlexible: true, tags: ['day-trip'] }), false)
})

test('missing dates are not one day; explicit duration works without calendar dates', async () => {
  const { tripDuration } = await import('../src/lib/dayTrips.ts')
  const placeholder = { ...trip, startDate: new Date('2026-09-17T12:34:56Z'), endDate: new Date('2026-09-17T12:34:56Z') }
  assert.equal(tripDuration(placeholder), null)
  assert.equal(tripDuration({ ...placeholder, durationDays: 4 }), 4)
  assert.equal(isDayTrip({ ...placeholder, durationDays: 4 }), false)
  assert.equal(tripDuration({ ...trip, datesFlexible: true, durationDays: 1 }), 1)
  assert.equal(tripDuration({ ...placeholder, destinations: [{ items: [{ type: 'activity', dayIndex: 0 }, { type: 'activity', dayIndex: 2 }] }] }), 3)
  assert.equal(tripDuration({ ...placeholder, postType: 'guide', destinations: [{ items: [{ type: 'activity', dayIndex: 1 }] }] }), null)
})
