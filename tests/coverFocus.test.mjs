import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCoverFocus, formatCoverFocus, coverStyle } from '../src/lib/coverFocus.ts'

test('cover framing is kept within bounds and centred means nothing stored', () => {
  assert.deepEqual(parseCoverFocus('30,70,1.46'), { x: 30, y: 70, zoom: 1.5 })
  assert.deepEqual(parseCoverFocus('-5,140,9'), { x: 0, y: 100, zoom: 3 })
  assert.deepEqual(parseCoverFocus('junk'), { x: 50, y: 50, zoom: 1 })
  assert.equal(formatCoverFocus({ x: 50, y: 50, zoom: 1 }), null)
  assert.equal(formatCoverFocus({ x: 20.4, y: 80, zoom: 2 }), '20,80,2')
})
test('the cover is centred on the chosen point and zoomed around it', () => {
  assert.equal(coverStyle(null), undefined)
  assert.deepEqual(coverStyle('20,80,1'), { objectPosition: '20% 80%' })
  assert.deepEqual(coverStyle('20,80,2'), { objectPosition: '20% 80%', transform: 'scale(2)', transformOrigin: '20% 80%' })
})
