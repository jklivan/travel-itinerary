import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tripMapLookupKey, validMapLocation } from '../src/lib/tripMapPlaces.ts'

test('same-name places in different cities cannot reuse each other’s location', () => {
  const place = { id: 'one', name: 'Central Cafe', city: 'Rome, Italy', type: 'food_drink', day: 1 }
  assert.notEqual(tripMapLookupKey(place), tripMapLookupKey({ ...place, city: 'Paris, France' }))
  assert.notEqual(tripMapLookupKey(place), tripMapLookupKey({ ...place, name: 'Another Cafe' }))
  assert.equal(tripMapLookupKey(place), tripMapLookupKey({ ...place, id: 'two', day: 3 }))
})

test('an explicitly selected place uses its exact location identity', () => {
  const place = { name: 'Hotel', city: 'Rome', placeId: 'exact-place' }
  assert.equal(tripMapLookupKey(place), 'id:exact-place')
  assert.notEqual(tripMapLookupKey(place), tripMapLookupKey({ ...place, placeId: '' }))
})

test('missing and malformed coordinates never become map pins; zero coordinates are valid', () => {
  for (const location of [null, {}, { lat: null, lng: null }, { lat: NaN, lng: 12 }, { lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: '41.9', lng: 12 }]) {
    assert.equal(validMapLocation(location), false)
  }
  assert.equal(validMapLocation({ lat: 0, lng: 0 }), true)
  assert.equal(validMapLocation({ lat: 41.9, lng: 12.5 }), true)
})
