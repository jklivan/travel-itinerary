import assert from 'node:assert/strict'
import { test } from 'node:test'
import { choosePlaceIdentity } from '../src/lib/placeIdentity.ts'
const item = { name: 'Cru', lat: 41.28446, lng: -70.09419, destination: { name: 'Nantucket', country: 'United States' } }
const candidate = { id: 'google-cru', displayName: { text: 'CRU Oyster Bar' }, location: { latitude: 41.2845, longitude: -70.0942 }, addressComponents: [{ longText: 'Nantucket', types: ['locality'] }, { longText: 'United States', shortText: 'US', types: ['country'] }] }
test('legacy CRU matches expanded Google name when destination and coordinates agree', () => {
  assert.equal(choosePlaceIdentity(item, [candidate]).match.id, 'google-cru')
})
test('same chain in another city or country is never accepted', () => {
  assert.equal(choosePlaceIdentity(item, [{ ...candidate, location: { latitude: 41.8, longitude: -87.6 } }]).match, null)
  assert.equal(choosePlaceIdentity(item, [{ ...candidate, addressComponents: [{ longText: 'Nantucket', types: ['locality'] }, { longText: 'Canada', shortText: 'CA', types: ['country'] }] }]).match, null)
})
test('multiple possible nearby branches remain unresolved', () => {
  assert.equal(choosePlaceIdentity(item, [candidate, { ...candidate, id: 'second-cru' }]).match, null)
})
test('without old coordinates only an exact name and destination match is automatic', () => {
  const noCoords = { name: 'Cru', destination: item.destination }
  assert.equal(choosePlaceIdentity(noCoords, [candidate]).match, null)
  assert.equal(choosePlaceIdentity(noCoords, [{ ...candidate, displayName: { text: 'CRU' } }]).match.id, 'google-cru')
})
test('different business and missing location evidence are rejected', () => {
  assert.equal(choosePlaceIdentity(item, [{ ...candidate, displayName: { text: 'Nantucket Tavern' } }]).match, null)
  assert.equal(choosePlaceIdentity(item, [{ ...candidate, addressComponents: [] }]).match, null)
})
