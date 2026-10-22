import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, deps = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => deps[name], Date, Number, Math, String })
  return exports
}
const dates = load('../src/lib/placeDates.ts')
const { importedPlaces } = load('../src/lib/planImport.ts', { './placeDates': dates })

test('a booking date becomes its day of the trip, whatever document it came from', () => {
  assert.equal(dates.tripDay('2026-04-01', '2026-04-01'), 1)
  assert.equal(dates.tripDay('2026-04-05', '2026-04-01'), 5)
  assert.equal(dates.tripDay('2026-03-02', '2026-02-27'), 4) // across a month end
  assert.equal(dates.daysBetween('2026-04-03', '2026-04-06'), 3)
})

test('times and dates read naturally', () => {
  assert.equal(dates.formatTime('19:30'), '7:30 pm')
  assert.equal(dates.formatTime('09:00'), '9 am')
  assert.equal(dates.formatTime('00:15'), '12:15 am')
  assert.equal(dates.whenLabel({ date: '2026-04-05', time: '19:30' }), 'Sun, Apr 5 · 7:30 pm')
  assert.equal(dates.whenLabel({ date: '2026-04-05', time: '19:30' }, false), '7:30 pm')
  assert.equal(dates.whenLabel({ date: '2026-04-03', endDate: '2026-04-06' }), 'Fri, Apr 3 – Mon, Apr 6')
})

test('imports keep well-formed dates and times, and a hotel gets its nights', () => {
  const [hotel, dinner, bad] = importedPlaces({ destinations: [{ name: 'Paris', country: 'France', items: [
    { type: 'hotel', name: 'Hotel A', notes: '', date: '2026-04-03', endDate: '2026-04-06', time: '15:00' },
    { type: 'food_drink', name: 'Bistro', notes: '', date: '2026-04-05', time: '19:30' },
    { type: 'activity', name: 'Tour', notes: '', date: 'April 5', time: '7pm', endDate: '2026-04-01' },
  ] }] })
  assert.equal(hotel.nights, 3); assert.equal(hotel.time, '15:00')
  assert.equal(dinner.date, '2026-04-05'); assert.equal(dinner.time, '19:30'); assert.equal(dinner.nights, null)
  assert.equal(bad.date, null); assert.equal(bad.time, null); assert.equal(bad.endDate, null)
})

test('dates outside the trip and double-booked nights are flagged', () => {
  const trip = { start: '2026-04-01', end: '2026-04-07' }
  const flags = dates.dateProblems([
    { type: 'food_drink', name: 'Late dinner', date: '2026-04-09', endDate: null },
    { type: 'hotel', name: 'Hotel A', date: '2026-04-01', endDate: '2026-04-04' },
    { type: 'hotel', name: 'Hotel B', date: '2026-04-03', endDate: '2026-04-07' },
    { type: 'hotel', name: 'Hotel C', date: '2026-04-04', endDate: '2026-04-07' },
    { type: 'activity', name: 'Museum', date: '2026-04-02', endDate: null },
  ], trip)
  assert.match(flags[0], /after the trip ends/)
  assert.match(flags[1], /Overlaps with Hotel B/)
  assert.equal(flags[4], null)
  // Checking out of A on the 4th and into C that day is fine.
  assert.equal(dates.dateProblems([{ type: 'hotel', name: 'A', date: '2026-04-01', endDate: '2026-04-04' }, { type: 'hotel', name: 'C', date: '2026-04-04', endDate: '2026-04-07' }], trip).every(flag => flag === null), true)
})

test('the trip starts when you land: an overnight flight the evening before goes on Day 1, not a day of its own', () => {
  const flight = { type: 'transport', name: 'JFK to Baltra', date: '2026-08-12', endDate: '2026-08-13' }
  const hotel = { type: 'hotel', name: 'Finch Bay', date: '2026-08-13', endDate: '2026-08-16' }
  const home = { type: 'transport', name: 'Baltra to JFK', date: '2026-08-17', endDate: null }
  const farAway = { type: 'activity', name: 'Wrong year', date: '2025-08-13', endDate: null }
  // No dates yet: from where you are, not the flights.
  assert.deepEqual({ ...dates.datesCovering([flight, hotel, home], null) }, { start: '2026-08-13', end: '2026-08-16' })
  // Dated Aug 13–21: the flight doesn't stretch it; a booking a year out is left for dateProblems to flag.
  assert.equal(dates.datesCovering([flight, hotel, farAway], { start: '2026-08-13', end: '2026-08-21' }), null)
  assert.equal(dates.datesCovering([hotel], { start: '2026-08-13', end: '2026-08-21' }), null)
  assert.equal(dates.datesCovering([{ ...hotel, date: null, endDate: null }], null), null)
  // Only flights in the documents: their dates are all there is.
  assert.deepEqual({ ...dates.datesCovering([flight], null) }, { start: '2026-08-12', end: '2026-08-13' })
  // Days: the outbound flight on Day 1, the flight home on the last day; neither is flagged.
  const trip = { start: '2026-08-13', end: '2026-08-16' }
  assert.equal(dates.dayOnTrip(flight, trip), 1); assert.equal(dates.dayOnTrip(home, trip), 4); assert.equal(dates.dayOnTrip(hotel, trip), 1)
  assert.equal(dates.dayOnTrip({ type: 'activity', date: '2026-08-12' }, trip), 0)
  assert.deepEqual(dates.dateProblems([flight, home], trip).map(Boolean), [false, false])
})
