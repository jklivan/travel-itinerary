import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bottomToolbarTop, keyboardCoversToolbar } from '../src/lib/bottomToolbar.ts'

test('toolbar remains at the screen bottom after scrolling and rotation', () => {
  assert.equal(bottomToolbarTop(0, 844, 80), 764)
  assert.equal(bottomToolbarTop(1200, 844, 80) - 1200 + 80, 844)
  assert.equal(bottomToolbarTop(1200, 390, 80) - 1200 + 80, 390)
  assert.equal(bottomToolbarTop(-30, 844, 80), 764)
})

test('only an open software keyboard hides the bar, not a residual iOS viewport offset or zoom', () => {
  assert.equal(keyboardCoversToolbar(true, 844, 500, 1), true)
  assert.equal(keyboardCoversToolbar(false, 844, 500, 1), false)
  assert.equal(keyboardCoversToolbar(true, 844, 820, 1), false)
  assert.equal(keyboardCoversToolbar(true, 844, 420, 2), false)
})
