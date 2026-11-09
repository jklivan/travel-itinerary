import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync, verify } from 'node:crypto'
import { appleClientSecret } from '../src/lib/appleSecret.ts'

// A throwaway P-256 key stands in for the Sign in with Apple .p8 key.
test('Apple client secret: an ES256 JWT for Apple, signed with the key; off until every setting is there', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  Object.assign(process.env, { APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', AUTH_APPLE_ID: 'com.example.web', APPLE_PRIVATE_KEY: pem.replace(/\n/g, '\\n') })
  const jwt = appleClientSecret()
  const [head, body, signature] = jwt.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url')), { alg: 'ES256', kid: 'KEY1234567' })
  const claims = JSON.parse(Buffer.from(body, 'base64url'))
  assert.equal(claims.iss, 'TEAM123456'); assert.equal(claims.sub, 'com.example.web'); assert.equal(claims.aud, 'https://appleid.apple.com')
  assert.ok(claims.exp - claims.iat <= 180 * 24 * 3600)
  assert.ok(verify('sha256', Buffer.from(`${head}.${body}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')))
  delete process.env.APPLE_KEY_ID
  assert.equal(appleClientSecret(), null)
})
