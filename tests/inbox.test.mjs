import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHmac } from 'node:crypto'
import { verifyWebhook, authenticatedFrom, tokenFrom, emailOf, cleanInboxName, suggestedInboxName, stableId } from '../src/lib/inbox.ts'

const secret = 'whsec_' + Buffer.from('a test signing secret').toString('base64')
const sign = (id, ts, body) => 'v1,' + createHmac('sha256', Buffer.from('a test signing secret')).update(`${id}.${ts}.${body}`).digest('base64')
const headers = (values) => new Headers(values)

test('only correctly signed, recent webhook calls are accepted', () => {
  const now = 1_800_000_000_000, ts = String(now / 1000), body = '{"type":"email.received"}'
  assert.equal(verifyWebhook(body, headers({ 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': sign('msg_1', ts, body) }), secret, now), true)
  assert.equal(verifyWebhook(body + ' ', headers({ 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': sign('msg_1', ts, body) }), secret, now), false)
  assert.equal(verifyWebhook(body, headers({ 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': 'v1,' + Buffer.from('nope').toString('base64') }), secret, now), false)
  const old = String(now / 1000 - 600)
  assert.equal(verifyWebhook(body, headers({ 'svix-id': 'msg_1', 'svix-timestamp': old, 'svix-signature': sign('msg_1', old, body) }), secret, now), false)
  assert.equal(verifyWebhook(body, headers({ 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': `v1,bad ${sign('msg_1', ts, body)}` }), secret, now), true)
})
test('a sender counts only when their own domain signed the message', () => {
  assert.equal(authenticatedFrom(['mx.resend; dkim=pass header.d=gmail.com header.s=20230601; spf=pass; dmarc=pass (p=NONE) header.from=gmail.com'], 'jen@gmail.com'), true)
  assert.equal(authenticatedFrom(['dkim=pass header.i=@mail.example.com'], 'a@mail.example.com'), true)
  assert.equal(authenticatedFrom(['dkim=pass header.d=attacker.com; dmarc=fail header.from=gmail.com'], 'jen@gmail.com'), false)
  assert.equal(authenticatedFrom([], 'jen@gmail.com'), false)
})
test('addresses: the name before the @, and the sender behind a display name', () => {
  assert.equal(tokenFrom(['Postcard <Jen.Rosenthal@in.postcardtravel.app>']), 'jen.rosenthal')
  assert.equal(tokenFrom(['trips-abm942ehm3@in.postcardtravel.app']), 'trips-abm942ehm3')
  assert.equal(tokenFrom(['jen@evil.example']), null)
  assert.equal(emailOf('Jen Rosenthal <Jen@Example.com>'), 'jen@example.com')
  assert.equal(stableId('email-1', 'x'), stableId('email-1', 'x'))
})
test('memorable addresses: suggested from the name, chosen ones cleaned and checked', () => {
  assert.equal(suggestedInboxName('Jen Rosenthal', 'jenp@gmail.com'), 'jen.rosenthal')
  assert.equal(suggestedInboxName('José  Núñez-Díaz', 'x@y.com'), 'jose.nunez.diaz')
  assert.equal(suggestedInboxName('', 'jk@oberdere.com'), 'traveler.jk')
  assert.deepEqual(cleanInboxName(' Rosenthal Family5 '), { name: 'rosenthal.family5' })
  assert.deepEqual(cleanInboxName('rosenthals@in.postcardtravel.app'), { name: 'rosenthals' })
  assert.ok('error' in cleanInboxName('support'))
  assert.ok('error' in cleanInboxName('trips-abc123defg'))
  assert.ok('error' in cleanInboxName('a'))
  assert.ok('error' in cleanInboxName('jen..r'))
})
