import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as nodeCrypto from 'node:crypto'
import ts from 'typescript'
import * as ids from '../src/lib/nativeSignInIds.ts'

// Loaded like the other tests (the module imports its IDs without a file extension).
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/nativeSignIn.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports, require: name => name === 'node:crypto' ? nodeCrypto : name === './nativeSignInIds' ? ids : undefined, Buffer, JSON, Date, fetch, AbortSignal, Map, Array, String })
const { verifyNativeIdToken } = exports
const { GOOGLE_IOS_CLIENT_ID, APP_BUNDLE_ID } = ids

// A stand-in for Apple's and Google's signing key, and tokens signed with it.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }
const keys = async () => ({ keys: [jwk] })
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = (claims, kid = 'k1', key = privateKey) => { const body = `${b64({ alg: 'RS256', kid })}.${b64(claims)}`; return `${body}.${sign('sha256', Buffer.from(body), key).toString('base64url')}` }
const now = 1_800_000_000_000, exp = now / 1000 + 600

test('a real Google or Apple token for our app gives its verified email', async () => {
  assert.deepEqual({ ...(await verifyNativeIdToken('google', token({ iss: 'https://accounts.google.com', aud: GOOGLE_IOS_CLIENT_ID, exp, email: 'Jen@Example.com', email_verified: true, name: 'Jen R' }), now, keys)) }, { email: 'jen@example.com', name: 'Jen R' })
  assert.deepEqual({ ...(await verifyNativeIdToken('apple', token({ iss: 'https://appleid.apple.com', aud: APP_BUNDLE_ID, exp, email: 'x@privaterelay.appleid.com', email_verified: 'true' }), now, keys)) }, { email: 'x@privaterelay.appleid.com', name: null })
})
test('forged, expired, unverified, wrong-app or wrong-issuer tokens are refused', async () => {
  const good = { iss: 'https://accounts.google.com', aud: GOOGLE_IOS_CLIENT_ID, exp, email: 'a@b.com', email_verified: true }
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  for (const bad of [
    token(good, 'k1', other),
    token({ ...good, exp: now / 1000 - 1 }),
    token({ ...good, email_verified: false }),
    token({ ...good, aud: 'someone-else.apps.googleusercontent.com' }),
    token({ ...good, iss: 'https://evil.example' }),
    token(good, 'unknown-key'),
    'not-a-token',
  ]) assert.equal(await verifyNativeIdToken('google', bad, now, keys), null)
  assert.equal(await verifyNativeIdToken('apple', token(good), now, keys), null, 'a Google token is not an Apple one')
  assert.equal(await verifyNativeIdToken('facebook', token(good), now, keys), null)
})
