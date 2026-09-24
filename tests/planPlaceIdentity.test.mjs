import assert from 'node:assert/strict'
import { test } from 'node:test'
import { samePlanDestination } from '../src/lib/planPlaceIdentity.ts'

test('destinations match on the city, with the country compared only when both have one', () => {
  const capri = { name: 'Capri', country: 'Italy' }
  // Google suggestions put region text before the country.
  assert.equal(samePlanDestination({ name: 'Capri', country: 'Metropolitan City of Naples, Italy' }, capri), true)
  assert.equal(samePlanDestination({ name: 'Capri', country: null }, capri), true)
  assert.equal(samePlanDestination({ name: 'capri, Metropolitan City of Naples, Italy' }, capri), true)
  assert.equal(samePlanDestination({ name: 'Rome', country: 'Italy' }, capri), false, 'same country alone is not a match')
  assert.equal(samePlanDestination({ name: 'Capri', country: 'Australia' }, capri), false)
})
