import assert from 'node:assert/strict'
import { test } from 'node:test'
import { flightStopFolds } from '../src/lib/flightStops.ts'

const stop = (id, order, ...types) => ({ id, name: id, order, items: types.map(type => ({ type })) })
test('a flights-only stop folds into the next real stop, else the one before', () => {
  const folds = flightStopFolds([stop('New York', 0, 'transport'), stop('Courchevel', 1, 'hotel', 'food_drink'), stop('Geneva', 2, 'transport')])
  assert.deepEqual(folds.map(({ from, into }) => `${from.id}→${into.id}`), ['New York→Courchevel', 'Geneva→Courchevel'])
})
test('real stops, empty stops and trips of only flights are left alone', () => {
  assert.deepEqual(flightStopFolds([stop('Paris', 0, 'hotel', 'transport'), stop('Empty', 1)]), [])
  assert.deepEqual(flightStopFolds([stop('JFK', 0, 'transport'), stop('LAX', 1, 'transport')]), [])
})
