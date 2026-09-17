import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previousPage, trackBackNavigation } from '../src/lib/backNavigation.ts'

test('records full previous path, preserves Next state through replace, and keeps browser history entries independent', () => {
  const location = { pathname: '/explore', search: '?q=London', hash: '#trips' }
  const history = {
    state: { __NA: true }, entries: [],
    pushState(state) { this.entries.push(this.state); this.state = state },
    replaceState(state) { this.state = state },
  }
  const stop = trackBackNavigation(history, location)
  assert.equal(previousPage(history.state), null)
  history.pushState({ __NA: true, tree: 'trip' }, '', '/itinerary/one')
  assert.equal(previousPage(history.state), '/explore?q=London#trips')
  history.replaceState({ __NA: true, tree: 'updated' }, '', '/itinerary/one')
  assert.equal(previousPage(history.state), '/explore?q=London#trips')
  assert.equal(history.state.tree, 'updated')
  Object.assign(location, { pathname: '/itinerary/one', search: '', hash: '' })
  history.pushState({ __NA: true }, '', '/user/friend')
  assert.equal(previousPage(history.state), '/itinerary/one')
  history.state = history.entries.pop()
  assert.equal(previousPage(history.state), '/explore?q=London#trips')
  stop()
})

test('direct arrivals and unsafe return paths have no previous in-app page', () => {
  for (const state of [null, {}, { __milesAwayPrevious: 'https://other.test' }, { __milesAwayPrevious: '//other.test' }, { __milesAwayPrevious: '/\\other.test' }]) {
    assert.equal(previousPage(state), null)
  }
})
