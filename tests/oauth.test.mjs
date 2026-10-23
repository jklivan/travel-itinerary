import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import * as crypto from 'node:crypto'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/oauth.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, URL, Response, Date, require: name => name === 'node:crypto' ? crypto : { prisma: {} } })
const { pkceMatches, validRedirect, authorizationServerMetadata, hash } = exports

test('PKCE: only the secret behind the challenge works', () => {
  const verifier = 'a'.repeat(43) + '-._~'
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  assert.equal(pkceMatches(verifier, challenge), true)
  assert.equal(pkceMatches(verifier + 'x', challenge), false)
  assert.equal(pkceMatches('short', createHash('sha256').update('short').digest('base64url')), false)
})
test('assistants can only be sent back to secure addresses (or a local computer)', () => {
  for (const ok of ['https://claude.ai/api/mcp/auth_callback', 'https://chatgpt.com/connector_platform_oauth_redirect', 'http://localhost:6274/callback', 'http://127.0.0.1:3000/cb']) assert.equal(validRedirect(ok), true, ok)
  for (const bad of ['http://evil.test/cb', 'javascript:alert(1)', 'https://x.test/cb#frag', 'not a url', 42]) assert.equal(validRedirect(bad), false, String(bad))
})
test('sign-in details point at this address, and keys are stored hashed', () => {
  const meta = authorizationServerMetadata('https://postcard.test')
  assert.equal(meta.token_endpoint, 'https://postcard.test/api/oauth/token')
  assert.equal(meta.code_challenge_methods_supported.join(), 'S256')
  assert.equal(hash('key').length, 64)
  assert.notEqual(hash('key'), 'key')
})
