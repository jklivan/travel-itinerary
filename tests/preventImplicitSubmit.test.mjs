import assert from 'node:assert/strict'
import { test } from 'node:test'
import { preventImplicitSubmit } from '../src/lib/preventImplicitSubmit.ts'

test('Enter blocks implicit trip submission but preserves newlines and keyboard controls', () => {
  for (const [tagName, type, expected] of [['INPUT', 'text', true], ['INPUT', 'url', true], ['TEXTAREA', 'textarea', false], ['BUTTON', 'submit', false], ['INPUT', 'submit', false]]) {
    let prevented = false
    preventImplicitSubmit({ key: 'Enter', defaultPrevented: false, target: { tagName, type }, preventDefault() { prevented = true } })
    assert.equal(prevented, expected, `${tagName} ${type}`)
  }
})
