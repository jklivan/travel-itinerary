import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../src/lib/passwordReset.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const module = { exports: {} }
vm.runInNewContext(source, { module, exports: module.exports, require, Buffer })
const { makeResetToken, resetTokenValid } = module.exports

test('a reset link works until it expires, and stops working once the password changes', () => {
  const now = Date.UTC(2026, 9, 14)
  const token = makeResetToken('user1', 'hash-old', 'secret', now)
  assert.equal(resetTokenValid(token, 'hash-old', 'secret', now + 30 * 60_000), true)
  assert.equal(resetTokenValid(token, 'hash-old', 'secret', now + 61 * 60_000), false)
  assert.equal(resetTokenValid(token, 'hash-new', 'secret', now), false)
  assert.equal(resetTokenValid(token, 'hash-old', 'other-secret', now), false)
})

test('a tampered or malformed reset link is rejected', () => {
  const now = Date.UTC(2026, 9, 14)
  const [, signed] = makeResetToken('user1', 'hash', 'secret', now).split('.')
  const forged = `${Buffer.from(`user2.${now + 60_000}`).toString('base64url')}.${signed}`
  assert.equal(resetTokenValid(forged, 'hash', 'secret', now), false)
  for (const bad of ['', 'x', 'a.b', null, 42, 'x'.repeat(600)]) assert.equal(resetTokenValid(bad, 'hash', 'secret', now), false)
})
