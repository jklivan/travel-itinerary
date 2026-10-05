import assert from 'node:assert/strict'
import { test } from 'node:test'
import { locationConditions } from '../src/lib/locationMatch.ts'

// The same text checks the database does, so the conditions can be tried against real-looking destinations.
function check(text, value) {
  if (value == null) return false
  const [v, t] = text.mode === 'insensitive' ? [value.toLowerCase(), Object.fromEntries(Object.entries(text).map(([k, x]) => [k, typeof x === 'string' ? x.toLowerCase() : x]))] : [value, text]
  return (t.contains === undefined || v.includes(t.contains)) && (t.startsWith === undefined || v.startsWith(t.startsWith))
    && (t.endsWith === undefined || v.endsWith(t.endsWith)) && (t.equals === undefined || v === t.equals)
}
const matches = (term, destination) => locationConditions(term).some(condition => 'name' in condition ? check(condition.name, destination.name) : check(condition.country, destination.country))

const losOlivos = { name: 'Los Olivos, CA, USA', country: null }
const storyOfSoil = { name: 'Story of Soil', country: 'San Marcos Avenue, Los Olivos, CA, USA' }
const nantucket = { name: 'Nantucket', country: 'United States' }
const boston = { name: 'Boston', country: 'MA, USA' }
const cancun = { name: 'Cancún', country: 'Mexico' }

test('a US state matches destinations written with its two-letter code', () => {
  assert.equal(matches('California', losOlivos), true)
  assert.equal(matches('California', storyOfSoil), true)
  assert.equal(matches('california', nantucket), false)
  assert.equal(matches('Massachusetts', boston), true)
  assert.equal(matches('CA', losOlivos), true)
  // A code never matches inside a word.
  assert.equal(matches('CA', cancun), false)
})
test('the United States matches every way it is written', () => {
  for (const term of ['United States', 'USA', 'us']) {
    assert.equal(matches(term, nantucket), true)
    assert.equal(matches(term, losOlivos), true)
    assert.equal(matches(term, boston), true)
  }
  assert.equal(matches('USA', { name: 'Busan', country: 'South Korea' }), false)
})
test('other places match by name as before', () => {
  assert.equal(matches('Nantucket', nantucket), true)
  assert.equal(matches('nantucket', losOlivos), false)
  assert.equal(matches('Mexico', cancun), true)
})
