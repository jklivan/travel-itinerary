import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keyboardCoversToolbar } from '../src/lib/bottomToolbar.ts'

test('only an open software keyboard hides the bar, not a residual iOS viewport offset or zoom', () => {
  assert.equal(keyboardCoversToolbar(true, 844, 500, 1), true)
  assert.equal(keyboardCoversToolbar(false, 844, 500, 1), false)
  assert.equal(keyboardCoversToolbar(true, 844, 820, 1), false)
  assert.equal(keyboardCoversToolbar(true, 844, 420, 2), false)
})
