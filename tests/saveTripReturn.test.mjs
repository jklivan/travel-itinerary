import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { saveTripId } from '../src/lib/saveTripReturn.ts'

test('save return rejects external URLs and path manipulation', () => {
  for (const value of [null, '//evil.test', 'https://evil.test', '../settings', 'trip?next=bad', 'a\\b', '%2f%2fevil', 'x'.repeat(129)]) assert.equal(saveTripId(value), '')
  assert.equal(saveTripId('test-trip_123'), 'test-trip_123')
})

test('successful sign-in returns to the selected trip, otherwise home', async () => {
  const source = ts.createSourceFile('auth.ts', readFileSync(new URL('../src/actions/auth.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'login')
  const code = ts.transpileModule(fn.getText(source).replace('export ', '') + '\nlogin(undefined, formData)', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  for (const [id, expected] of [['test-trip', '/itinerary/test-trip'], ['', '/'], ['//evil.test', '/']]) {
    const formData = new FormData()
    formData.set('saveTrip', id)
    let destination
    await vm.runInNewContext(code, { formData, saveTripId, AuthError: class extends Error {}, signIn: async (_, options) => { destination = options.redirectTo } })
    assert.equal(destination, expected)
  }
})
