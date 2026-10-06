import assert from 'node:assert/strict'
import { test } from 'node:test'
import { destinationRanges, stayOn, totalDays } from '../src/lib/tripStays.ts'

const ischia = { id: 'i', name: 'Ischia', days: 4, items: [] }
const ravello = { id: 'r', name: 'Ravello', days: 3, items: [] }

test('destination days follow on from each other', () => {
  const ranges = destinationRanges([ischia, ravello])
  assert.deepEqual(ranges.get('i'), { start: 1, end: 4 })
  assert.deepEqual(ranges.get('r'), { start: 5, end: 7 })
  assert.equal(totalDays([ischia, ravello]), 7)
  assert.equal(stayOn(5, [ischia, ravello]).destination, 'Ravello')
})
test('a hotel with a check-in day and nights sets its destination\'s days, and shows as the stay', () => {
  const withHotel = { ...ischia, days: null, items: [{ name: 'Mezzatorre', type: 'hotel', day: 1, nights: 5 }] }
  const ranges = destinationRanges([withHotel, ravello])
  assert.deepEqual(ranges.get('i'), { start: 1, end: 5 })
  assert.deepEqual(ranges.get('r'), { start: 6, end: 8 })
  assert.deepEqual(stayOn(3, [withHotel, ravello]), { destination: 'Ischia', hotel: 'Mezzatorre' })
  assert.deepEqual(stayOn(6, [withHotel, ravello]), { destination: 'Ravello', hotel: undefined })
})
test('destinations without days have none, and are skipped', () => {
  const ranges = destinationRanges([{ ...ischia, days: null }, ravello])
  assert.equal(ranges.has('i'), false)
  assert.deepEqual(ranges.get('r'), { start: 1, end: 3 })
  assert.equal(totalDays([{ ...ischia, days: null }]), 0)
})
