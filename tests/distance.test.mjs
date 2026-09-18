import assert from 'node:assert/strict'
import { test } from 'node:test'
import { distanceMiles } from '../src/lib/distance.ts'

test('distanceMiles returns zero for identical coordinates', () => {
  assert.equal(distanceMiles({ lat: 41.7, lng: -71.3 }, { lat: 41.7, lng: -71.3 }), 0)
})

test('distanceMiles measures a one-degree latitude change in miles', () => {
  const distance = distanceMiles({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
  assert.ok(distance > 69 && distance < 70)
})

test('distanceMiles is symmetric and handles longitude across the equator', () => {
  const a = { lat: 0, lng: 0 }
  const b = { lat: 0, lng: 1 }
  assert.equal(distanceMiles(a, b), distanceMiles(b, a))
  assert.ok(distanceMiles(a, b) > 69 && distanceMiles(a, b) < 70)
})
