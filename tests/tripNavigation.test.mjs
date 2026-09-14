import assert from 'node:assert/strict'
import { test } from 'node:test'
import { internalPath, rememberTripReturn, tripReturnPath } from '../src/lib/tripNavigation.ts'

function storage() {
  const entries = new Map()
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
}

test('profile tab and saved folder survive trip views, editing, and returning after save', () => {
  const store = storage()
  const origin = '/user/me?tab=bucket&folder=summer'
  rememberTripReturn(origin, '/itinerary/trip', store)
  rememberTripReturn('/itinerary/trip', '/itinerary/trip?view=map', store)
  rememberTripReturn('/itinerary/trip?view=map', '/itinerary/trip/edit', store)
  rememberTripReturn('/itinerary/trip/edit', '/itinerary/trip', store)
  assert.equal(store.getItem('trip-return:trip'), origin)
})

test('new visits update their origin; separate trips retain separate return pages', () => {
  const store = storage()
  rememberTripReturn('/?search=Rome', '/itinerary/a', store)
  rememberTripReturn('/explore?q=beach', '/itinerary/b', store)
  assert.equal(store.getItem('trip-return:a'), '/?search=Rome')
  assert.equal(store.getItem('trip-return:b'), '/explore?q=beach')
  rememberTripReturn('/user/me', '/itinerary/a/edit', store)
  assert.equal(store.getItem('trip-return:a'), '/user/me')
})

test('external addresses and malformed destinations cannot become back links', () => {
  for (const path of ['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', '/\n/evil']) assert.equal(internalPath(path), null)
  const store = storage()
  rememberTripReturn('//example.com', '/itinerary/a', store)
  assert.equal(store.getItem('trip-return:a'), null)
})

test('direct visits and unavailable storage use the supplied fallback', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  try {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() })
    assert.equal(tripReturnPath('trip', '/user/me'), '/user/me')
    globalThis.sessionStorage.setItem('trip-return:trip', '/user/me?tab=bucket')
    assert.equal(tripReturnPath('trip', '/'), '/user/me?tab=bucket')
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw Error('unavailable') } })
    assert.equal(tripReturnPath('trip', '/user/me'), '/user/me')
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor)
    else delete globalThis.sessionStorage
  }
})
