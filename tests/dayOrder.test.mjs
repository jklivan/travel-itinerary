import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sortDay, insertIntoDay } from '../src/lib/dayOrder.ts'

const names = list => list.map(place => place.name)
test('Jen’s Courchevel Day 1: flights, car rental, hotel, lunch, dinner', () => {
  const day = [
    { type: 'transport', name: 'Flight 1 JFK to GVA' }, { type: 'transport', name: 'Flight 2 GVA to CMF' },
    { type: 'food_drink', name: 'Lunch spot', mealType: 'lunch' }, { type: 'food_drink', name: 'Dinner spot', mealType: 'dinner' },
    { type: 'transport', name: 'Hertz car rental' }, { type: 'hotel', name: 'Cheval Blanc' },
  ]
  assert.deepEqual(names(sortDay(day, { day: 1, lastDay: 6 })), ['Flight 1 JFK to GVA', 'Flight 2 GVA to CMF', 'Hertz car rental', 'Cheval Blanc', 'Lunch spot', 'Dinner spot'])
})
test('the last day ends with the transfer and the flight home; times win; things to do stay by their neighbours', () => {
  const day = [{ type: 'transport', name: 'Flight home' }, { type: 'transport', name: 'Transfer to airport' }, { type: 'food_drink', name: 'Breakfast', mealType: 'breakfast' }, { type: 'activity', name: 'Museum' }]
  assert.deepEqual(names(sortDay(day, { day: 5, lastDay: 5 })), ['Breakfast', 'Museum', 'Transfer to airport', 'Flight home'])
  assert.deepEqual(names(sortDay([{ type: 'food_drink', name: 'Late lunch', mealType: 'lunch', time: '15:00' }, { type: 'activity', name: 'Tour', time: '13:00' }], { day: 2, lastDay: 5 })), ['Tour', 'Late lunch'])
})
test('a new place is slotted in without moving places already put in order by hand', () => {
  const existing = [{ type: 'food_drink', name: 'Dinner', mealType: 'dinner' }, { type: 'activity', name: 'Walk' }, { type: 'food_drink', name: 'Lunch', mealType: 'lunch' }]
  assert.deepEqual(names(insertIntoDay(existing, [{ type: 'hotel', name: 'Hotel' }], { day: 2, lastDay: 4 })), ['Hotel', 'Dinner', 'Walk', 'Lunch'])
  assert.deepEqual(names(insertIntoDay(existing, [{ type: 'activity', name: 'Museum' }], { day: 2, lastDay: 4 })), ['Dinner', 'Walk', 'Lunch', 'Museum'])
})
