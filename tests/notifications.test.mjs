import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

function load(path, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`)
    return dependencies[name]
  }, console, Date, process, ...globals })
  return exports
}
const { createTripNotification } = load('../src/lib/notifications.ts')
const text = load('../src/lib/notificationText.ts')

function harness(userId = 'visitor') {
  const rows = new Map()
  const saved = new Set()
  const comments = []
  const scheduled = []
  const itinerary = { userId: 'owner', visibility: 'public' }
  const tx = {
    notification: { createManyAndReturn: async ({ data }) => {
      const n = data[0]
      if (rows.has(n.dedupeKey)) return []
      const row = { ...n, id: `notification-${rows.size}` }
      rows.set(n.dedupeKey, row)
      return [row]
    } },
    bucketListItem: { createMany: async ({ data }) => {
      const key = `${data[0].userId}:${data[0].itineraryId}`
      if (saved.has(key)) return { count: 0 }
      saved.add(key)
      return { count: 1 }
    } },
    comment: { create: async ({ data }) => { const row = { ...data, id: `comment-${comments.length}` }; comments.push(row); return row } },
  }
  const prisma = {
    ...tx, itinerary: { findUnique: async () => itinerary },
    $transaction: async fn => fn(tx),
    comment: { findUnique: async () => null },
  }
  const deps = {
    '@/lib/prisma': { prisma }, '@/auth': { auth: async () => userId ? { user: { id: userId } } : null },
    'next/cache': { revalidatePath() {} }, 'next/server': { after: fn => scheduled.push(fn) },
    '@/lib/notifications': { createTripNotification }, '@/lib/push': { deliverNotification() {} },
  }
  return { rows, saved, comments, scheduled, itinerary, deps }
}

test('comment and reply alerts go to the trip owner and link to comments', async () => {
  const h = harness()
  const { addComment } = load('../src/actions/comments.ts', h.deps)
  await addComment('trip', 'Lovely trip!')
  assert.equal(h.comments.length, 1)
  const n = [...h.rows.values()][0]
  assert.equal(n.recipientId, 'owner')
  assert.equal(n.actorId, 'visitor')
  assert.equal(n.commentId, h.comments[0].id)
  assert.equal(h.scheduled.length, 1)
  assert.equal(text.notificationPath('trip', n.kind), '/itinerary/trip#comments')
  h.deps['@/lib/prisma'].prisma.comment.findUnique = async () => ({ itineraryId: 'trip', parentId: null })
  await addComment('trip', 'Reply', 'parent')
  assert.equal(h.rows.size, 2)
})

test('own comments and own saves create no alerts', async () => {
  const h = harness('owner')
  await load('../src/actions/comments.ts', h.deps).addComment('trip', 'My follow-up')
  await load('../src/actions/bucketList.ts', h.deps).addToBucketList('trip')
  assert.equal(h.rows.size, 0)
  assert.equal(h.scheduled.length, 0)
})

test('repeated saves and unsave/resave do not spam the owner', async () => {
  const h = harness()
  const { addToBucketList } = load('../src/actions/bucketList.ts', h.deps)
  await addToBucketList('trip')
  await addToBucketList('trip')
  h.saved.clear()
  await addToBucketList('trip')
  assert.equal(h.rows.size, 1)
  assert.equal(h.scheduled.length, 1)
})

test('anonymous visitors and draft trips cannot generate activity', async () => {
  for (const userId of [null, 'visitor']) {
    const h = harness(userId)
    h.itinerary.visibility = 'draft'
    assert.ok((await load('../src/actions/comments.ts', h.deps).addComment('trip', 'Hello')).error)
    assert.ok((await load('../src/actions/bucketList.ts', h.deps).addToBucketList('trip')).error)
    assert.equal(h.rows.size, 0)
    assert.equal(h.saved.size, 0)
    assert.equal(h.comments.length, 0)
  }
})

test('invalid replies do not generate a comment or alert', async () => {
  const h = harness()
  const result = await load('../src/actions/comments.ts', h.deps).addComment('trip', 'Reply', 'other-trip-comment')
  assert.ok(result.error)
  assert.equal(h.comments.length, 0)
  assert.equal(h.rows.size, 0)
})

function notificationActions(prisma, cookieJar = { get() {}, set() {}, delete() {} }) {
  return load('../src/actions/notifications.ts', {
    '@/auth': { auth: async () => ({ user: { id: 'owner' } }) }, '@/lib/prisma': { prisma },
    'next/headers': { cookies: async () => cookieJar }, 'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: path => { throw new Error(`redirect:${path}`) } },
    '@/lib/push': { pushConfigured: () => true }, '@/lib/notificationText': text,
  })
}

test('marking read and opening notifications are scoped to the signed-in recipient', async () => {
  const queries = []
  const actions = notificationActions({ notification: {
    updateMany: async query => { queries.push(query); return { count: 0 } },
    findFirst: async query => { queries.push(query); return null },
  } })
  await actions.markAllNotificationsRead()
  await actions.openNotification(new Map([['id', 'someone-elses-notification']]))
  assert.equal(queries.length, 2)
  for (const query of queries) assert.equal(query.where.recipientId, 'owner')
})

test('device registration validates tokens and binds the device to the session user', async () => {
  let registration
  let cookie
  const actions = notificationActions({ pushDevice: { upsert: async query => { registration = query; return { id: 'device-1' } } } },
    { get() {}, set: (...args) => { cookie = args } })
  assert.ok((await actions.registerPushDevice('../invalid')).error)
  assert.equal(registration, undefined)
  await actions.registerPushDevice('A'.repeat(64))
  assert.equal(registration.create.userId, 'owner')
  assert.equal(registration.update.userId, 'owner')
  assert.equal(registration.where.token, 'a'.repeat(64))
  assert.equal(cookie[2].httpOnly, true)
})

test('sign-out removes only the current user’s current device', async () => {
  let removed
  const actions = notificationActions({ pushDevice: { deleteMany: async query => { removed = query.where } } },
    { get: () => ({ value: 'device-1' }), delete() {} })
  await actions.unregisterPushDevice()
  assert.equal(removed.id, 'device-1')
  assert.equal(removed.userId, 'owner')
})

test('APNs sends a signed production alert with the expected trip link and no comment text', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const env = { APNS_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }), APNS_KEY_ID: 'key', APNS_TEAM_ID: 'team', APNS_BUNDLE_ID: 'com.example.app' }
  let host, headers, payload
  const http2 = { connect: url => {
    host = url
    const client = new EventEmitter()
    client.close = () => {}
    client.destroy = () => {}
    client.request = value => {
      headers = value
      const request = new EventEmitter()
      request.setEncoding = () => {}
      request.end = body => { payload = JSON.parse(body); request.emit('response', { ':status': 200 }); request.emit('end') }
      return request
    }
    return client
  } }
  const { deliverNotification } = load('../src/lib/push.ts', {
    'node:crypto': crypto, 'node:http2': http2, '@/lib/notificationText': text,
    '@/lib/prisma': { prisma: {
      notification: { findUnique: async () => ({ recipientId: 'owner', kind: 'comment', itineraryId: 'trip', actor: { name: 'Friend' }, itinerary: { title: 'London', visibility: 'public' } }) },
      pushDevice: { findMany: async () => [{ id: 'device', token: 'a'.repeat(64) }] },
    } },
  }, { process: { env }, Buffer, setTimeout, clearTimeout })
  await deliverNotification('n1')
  assert.equal(host, 'https://api.push.apple.com')
  assert.equal(headers['apns-topic'], 'com.example.app')
  assert.equal(headers['apns-push-type'], 'alert')
  assert.equal(payload.notificationId, 'n1')
  assert.equal(payload.url, '/itinerary/trip#comments')
  assert.equal(payload.aps.alert.body, 'Friend commented on your trip “London”.')
  const [head, claims, signature] = headers.authorization.slice(7).split('.')
  assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).iss, 'team')
  assert.ok(crypto.verify('sha256', Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')))
})
