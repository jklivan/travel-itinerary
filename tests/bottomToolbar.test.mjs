import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keyboardCoversToolbar, viewportLeftShifted } from '../src/lib/bottomToolbar.ts'

test('only an open software keyboard hides the bar, not a residual iOS viewport offset or zoom', () => {
  assert.equal(keyboardCoversToolbar(true, 844, 500, 1), true)
  assert.equal(keyboardCoversToolbar(false, 844, 500, 1), false)
  assert.equal(keyboardCoversToolbar(true, 844, 820, 1), false)
  assert.equal(keyboardCoversToolbar(true, 844, 420, 2), false)
})

test('a page left shifted after the keyboard closes is detected, but not while typing or zoomed', () => {
  assert.equal(viewportLeftShifted(false, 300, 1), true)
  assert.equal(viewportLeftShifted(true, 300, 1), false)
  assert.equal(viewportLeftShifted(false, 300, 2), false)
  assert.equal(viewportLeftShifted(false, 0, 1), false)
})
