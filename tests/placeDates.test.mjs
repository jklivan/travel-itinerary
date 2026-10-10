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
