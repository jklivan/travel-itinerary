import assert from 'node:assert/strict'
import { test } from 'node:test'
import { samePlanDestination, sameSnapshotPlace } from '../src/lib/planPlaceIdentity.ts'

test('destinations match on the city, with the country compared only when both have one', () => {
  const capri = { name: 'Capri', country: 'Italy' }
  // Google suggestions put region text before the country.
  assert.equal(samePlanDestination({ name: 'Capri', country: 'Metropolitan City of Naples, Italy' }, capri), true)
  assert.equal(samePlanDestination({ name: 'Capri', country: null }, capri), true)
  assert.equal(samePlanDestination({ name: 'capri, Metropolitan City of Naples, Italy' }, capri), true)
  assert.equal(samePlanDestination({ name: 'Rome', country: 'Italy' }, capri), false, 'same country alone is not a match')
  assert.equal(samePlanDestination({ name: 'Capri', country: 'Australia' }, capri), false)
})

test('a snapshot joins the same place already in the trip, whatever category it was filed under', () => {
  const nantucket = { name: 'Nantucket', country: 'MA, USA' }
  const inTrip = { name: 'The Chanticleer', placeId: null, destination: nantucket }
  // Same name and destination, different capitalisation and spacing.
  assert.equal(sameSnapshotPlace(inTrip, { name: '  the  chanticleer ', placeId: 'g1', destination: { name: 'Nantucket, MA', country: 'USA' } }), true)
  // Different town, or a different name, stays separate.
  assert.equal(sameSnapshotPlace(inTrip, { name: 'The Chanticleer', placeId: null, destination: { name: 'Boston', country: 'USA' } }), false)
  assert.equal(sameSnapshotPlace(inTrip, { name: 'Cisco Brewers', placeId: null, destination: nantucket }), false)
  // When both have a Google place, that decides it.
  assert.equal(sameSnapshotPlace({ ...inTrip, placeId: 'g1' }, { name: 'Chanticleer Restaurant', placeId: 'g1', destination: nantucket }), true)
  assert.equal(sameSnapshotPlace({ ...inTrip, placeId: 'g1' }, { name: 'The Chanticleer', placeId: 'g2', destination: nantucket }), false)
})
