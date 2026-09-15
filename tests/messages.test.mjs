import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function harness(userId = 'alice') {
  const rows = []
  const notifications = []
  const scheduled = []
  const readQueries = []
  let failNotification = false
  const people = new Map(['alice', 'bob', 'eve'].map(id => [id, { id, name: id }]))
  const queries = []
  const place = { id: 'cafe', name: 'Cafe', notes: 'Try the breakfast', destination: { itinerary: { id: 'trip', title: 'Paris' } } }
  const match = (row, where) => (!where.id || row.id === where.id) && where.OR.some(pair => Object.entries(pair).every(([k, v]) => row[k] === v))
  const prisma = {
    notification: {
      createManyAndReturn: async ({ data, skipDuplicates }) => {
        if (failNotification) throw new Error('notification failed')
        assert.equal(skipDuplicates, true)
        return data.flatMap(input => {
          if (notifications.some(n => n.dedupeKey === input.dedupeKey)) return []
          const row = { id: `n${notifications.length}`, readAt: null, ...input }
          notifications.push(row)
          return [row]
        })
      },
      updateMany: async query => {
        readQueries.push(query)
        let count = 0
        for (const n of notifications) {
          const w = query.where
          const message = rows.find(m => m.id === n.messageId)
          if (n.recipientId === w.recipientId && n.actorId === w.actorId && n.kind === w.kind && n.readAt === null && w.messageId.in.includes(n.messageId) && message?.senderId === w.message.senderId && message?.recipientId === w.message.recipientId) {
            n.readAt = query.data.readAt
            count++
          }
        }
        return { count }
      },
    },
    user: { findUnique: async ({ where }) => people.get(where.id) },
    destItem: { findFirst: async ({ where }) => { queries.push(where); return where.id === 'cafe' ? place : null } },
    directMessage: {
      findFirst: async ({ where }) => rows.find(row => match(row, where)),
      findMany: async query => {
        queries.push(query)
        let found = rows.filter(row => match(row, query.where)).sort((a, b) => b.createdAt - a.createdAt)
        if (query.distinct) {
          const seen = new Set()
          found = found.filter(row => { const key = `${row.senderId}:${row.recipientId}`; if (seen.has(key)) return false; seen.add(key); return true })
        }
        if (query.cursor) found = found.slice(found.findIndex(row => row.id === query.cursor.id) + query.skip)
        return found.slice(0, query.take).map(row => ({ ...row, sender: people.get(row.senderId), recipient: people.get(row.recipientId) }))
      },
      upsert: async ({ create }) => {
        let row = rows.find(row => row.senderId === create.senderId && row.clientId === create.clientId)
        if (!row) { row = { id: `m${rows.length}`, createdAt: new Date(rows.length * 1000), ...create }; rows.push(row) }
        return row
      },
    },
  }
  prisma.$transaction = async fn => {
    const rowCount = rows.length
    const notificationCount = notifications.length
    try { return await fn(prisma) } catch (error) { rows.splice(rowCount); notifications.splice(notificationCount); throw error }
  }
  const dependencies = { '@/auth': { auth: async () => userId ? { user: { id: userId } } : null }, '@/lib/prisma': { prisma }, 'next/cache': { revalidatePath() {} }, 'next/server': { after: fn => scheduled.push(fn) }, '@/lib/push': { deliverNotification() {} } }
  const exports = {}
  const compiled = ts.transpileModule(readFileSync(new URL('../src/actions/messages.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { exports, require: name => dependencies[name] })
  const input = { recipientId: 'bob', content: 'Hello', clientId: '12345678-1234-1234-1234-123456789012' }
  return { ...exports, rows, queries, input, notifications, scheduled, readQueries, failNotification: () => { failNotification = true } }
}

test('all message endpoints require sign-in', async () => {
  const h = harness(null)
  assert.ok((await h.sendDirectMessage(h.input)).error)
  assert.ok((await h.getConversation('bob')).error)
  assert.ok((await h.getMessageInbox()).error)
  assert.equal(h.rows.length, 0)
})
test('any signed-in traveler can send, with sender derived from session and retry deduplication', async () => {
  const h = harness()
  await h.sendDirectMessage({ ...h.input, senderId: 'eve' })
  await h.sendDirectMessage(h.input)
  assert.equal(h.rows.length, 1)
  assert.equal(h.rows[0].senderId, 'alice')
  assert.equal(h.rows[0].recipientId, 'bob')
})
test('rejects empty, oversized, self-addressed, missing-recipient and malformed messages', async () => {
  const h = harness()
  for (const update of [{content:' '},{content:'x'.repeat(4001)},{recipientId:'alice'},{recipientId:'missing'},{clientId:'bad'}]) {
    assert.ok((await h.sendDirectMessage({...h.input,...update})).error)
  }
  assert.equal(h.rows.length,0)
})
test('attachment content comes from a non-draft database place, not client supplied notes', async () => {
  const h = harness()
  await h.sendDirectMessage({...h.input, placeId:'cafe', placeNotes:'forged'})
  assert.equal(h.rows[0].placeNotes,'Try the breakfast')
  assert.equal(h.rows[0].itineraryId,'trip')
  assert.equal(h.queries[0].destination.itinerary.visibility.not,'draft')
  assert.ok((await h.sendDirectMessage({...h.input, placeId:'deleted-or-draft'})).error)
})
test('conversation reads exclude messages involving a third party and reject foreign cursors', async () => {
  const h = harness()
  h.rows.push({id:'secret',senderId:'bob',recipientId:'eve',content:'secret',createdAt:new Date()})
  await h.sendDirectMessage(h.input)
  const result = await h.getConversation('bob')
  assert.equal(result.messages.length,1)
  assert.equal(result.messages[0].content,'Hello')
  assert.ok((await h.getConversation('bob','secret')).error)
})
test('inbox excludes other users conversations and combines both directions', async () => {
  const h = harness()
  await h.sendDirectMessage(h.input)
  h.rows.push({id:'reply',senderId:'bob',recipientId:'alice',content:'Reply',createdAt:new Date(2000)})
  h.rows.push({id:'secret',senderId:'bob',recipientId:'eve',content:'Secret',createdAt:new Date(3000)})
  const result = await h.getMessageInbox()
  assert.equal(result.threads.length,1)
  assert.equal(result.threads[0].person.id,'bob')
  assert.equal(result.threads[0].content,'Reply')
})
test('older messages page without dropping or duplicating messages', async () => {
  const h = harness()
  for (let i=0;i<105;i++) h.rows.push({id:`m${i}`,senderId:'alice',recipientId:'bob',content:String(i),createdAt:new Date(i*1000)})
  const latest=await h.getConversation('bob')
  assert.equal(latest.messages.length,100)
  assert.equal(latest.hasOlder,true)
  const older=await h.getConversation('bob',latest.messages[0].id)
  assert.equal(older.messages.length,5)
  assert.equal(older.hasOlder,false)
  assert.equal(older.messages[0].content,'0')
})


test('a message creates one recipient alert and schedules one push, even on retry', async () => {
  const h = harness()
  await h.sendDirectMessage(h.input)
  await h.sendDirectMessage(h.input)
  assert.equal(h.notifications.length, 1)
  assert.equal(h.scheduled.length, 1)
  const n = h.notifications[0]
  assert.equal(n.kind, 'message')
  assert.equal(n.recipientId, 'bob')
  assert.equal(n.actorId, 'alice')
  assert.equal(n.messageId, h.rows[0].id)
  assert.equal(n.readAt, null)
  assert.equal(n.itineraryId, undefined)
})

test('a failed alert rolls back the message and never schedules a push', async () => {
  const h = harness()
  h.failNotification()
  await assert.rejects(h.sendDirectMessage(h.input), /notification failed/)
  assert.equal(h.rows.length, 0)
  assert.equal(h.notifications.length, 0)
  assert.equal(h.scheduled.length, 0)
})

test('a retry with a changed recipient cannot redirect an existing message alert', async () => {
  const h = harness()
  await h.sendDirectMessage(h.input)
  await h.sendDirectMessage({ ...h.input, recipientId: 'eve' })
  assert.equal(h.notifications.length, 1)
  assert.equal(h.notifications[0].recipientId, 'bob')
})

test('reading a conversation clears only displayed messages from that sender to the session user', async () => {
  const h = harness()
  for (const [id, senderId, recipientId] of [['shown','bob','alice'], ['new','bob','alice'], ['other','eve','alice'], ['foreign','bob','eve']]) {
    h.rows.push({ id, senderId, recipientId })
    h.notifications.push({ id: `n-${id}`, messageId: id, recipientId, actorId: senderId, kind: 'message', readAt: null })
  }
  await h.markMessagesRead('bob', ['shown', 'other', 'foreign'])
  assert.ok(h.notifications[0].readAt)
  for (const n of h.notifications.slice(1)) assert.equal(n.readAt, null)
  assert.equal(h.readQueries[0].where.recipientId, 'alice')
})

test('anonymous and malformed read requests cannot clear message alerts', async () => {
  const anonymous = harness(null)
  await anonymous.markMessagesRead('bob', ['message'])
  assert.equal(anonymous.readQueries.length, 0)
  const h = harness()
  await h.markMessagesRead('bob', new Array(101).fill('message'))
  await h.markMessagesRead('bob', [123])
  await h.markMessagesRead('bob', [])
  assert.equal(h.readQueries.length, 0)
})
