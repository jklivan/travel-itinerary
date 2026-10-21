import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inTimeOrder } from '../src/lib/timeOrder.ts'

test('a day puts timed places (a flight, a dinner) in time order and leaves untimed places where they are', () => {
  const day = [
    { name: 'Dinner at Belcanto', time: '20:00' },
    { name: 'Walk in Alfama', time: null },
    { name: 'Flight to Lisbon', time: '07:15' },
    { name: 'Museum', time: undefined },
    { name: 'Train to Sintra', time: '11:30' },
  ]
  assert.deepEqual(inTimeOrder(day).map(place => place.name), ['Flight to Lisbon', 'Walk in Alfama', 'Train to Sintra', 'Museum', 'Dinner at Belcanto'])
  assert.deepEqual(inTimeOrder([{ name: 'A' }, { name: 'B' }]).map(place => place.name), ['A', 'B'])
})
