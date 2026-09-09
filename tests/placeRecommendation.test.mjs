import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRecommendation, recommendationTags } from '../src/lib/placeRecommendation.ts'

test('recommendations default to none and retain explicit legacy selections', () => {
  assert.equal(getRecommendation(), 'none')
  assert.equal(getRecommendation(['Local Favorite']), 'none')
  assert.equal(getRecommendation([], true), 'must')
  assert.equal(getRecommendation(['__highlight']), 'must')
  assert.equal(getRecommendation(['__avoid']), 'avoid')
})

test('switching between stamps is exclusive and preserves unrelated tags', () => {
  const original = ['Boutique', '__highlight']
  const avoided = recommendationTags(original, 'avoid')
  assert.deepEqual(avoided, ['Boutique', '__avoid'])
  assert.deepEqual(recommendationTags(avoided, 'must'), original)
  assert.deepEqual(recommendationTags(avoided, 'none'), ['Boutique'])
  assert.deepEqual(original, ['Boutique', '__highlight'])
})

test('avoid wins over stale highlight flags and contradictory tags', () => {
  assert.equal(getRecommendation(['__avoid'], true), 'avoid')
  const tags = ['Cultural', '__highlight', '__avoid']
  assert.deepEqual(recommendationTags(tags, getRecommendation(tags)), ['Cultural', '__avoid'])
})

test('older Must-Do labels require an explicit user selection to become stamps', () => {
  const legacy = ['Cultural', 'Must-Do']
  assert.equal(getRecommendation(legacy), 'none')
  assert.equal(getRecommendation(legacy, true), 'must')
  assert.deepEqual(recommendationTags(legacy, 'must'), ['Cultural', '__highlight'])
  const removed = recommendationTags(legacy, 'none')
  assert.deepEqual(removed, ['Cultural'])
  assert.equal(getRecommendation(removed), 'none')
  assert.deepEqual(recommendationTags(legacy, 'avoid'), ['Cultural', '__avoid'])
  assert.equal(getRecommendation([...legacy, '__avoid']), 'avoid')
})
