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
  const fns = ['loginDestination', 'login'].map(name => source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(source).replace('export ', ''))
  const code = ts.transpileModule(fns.join('\n') + '\nlogin(undefined, formData)', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  // [trip being saved, just created an account, where sign-in goes]
  for (const [id, registered, expected] of [['test-trip', false, '/itinerary/test-trip'], ['', false, '/'], ['//evil.test', false, '/'], ['', true, '/welcome'], ['test-trip', true, '/welcome?saveTrip=test-trip']]) {
    const formData = new FormData()
    formData.set('saveTrip', id)
    if (registered) formData.set('registered', '1')
    let destination
    await vm.runInNewContext(code, { formData, saveTripId, AuthError: class extends Error {}, signIn: async (_, options) => { destination = options.redirectTo } })
    assert.equal(destination, expected)
  }
})
