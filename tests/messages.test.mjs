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
  const match = (row, where) => (!where.id || row.id === where.id) && (!('itineraryId' in where) || (row.itineraryId ?? null) === where.itineraryId) && where.OR.some(pair => Object.entries(pair).every(([k, v]) => row[k] === v))
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
    itinerary: { findFirst: async ({ where }) => { queries.push(where); return where.id === 'trip' ? { id: 'trip', title: 'Paris' } : null } },
    destItem: { findFirst: async ({ where }) => { queries.push(where); return where.id === 'cafe' ? place : null } },
    directMessage: {
      findFirst: async ({ where }) => rows.find(row => match(row, where)),
      findMany: async query => {
        queries.push(query)
        let found = rows.filter(row => match(row, query.where)).sort((a, b) => b.createdAt - a.createdAt)
        if (query.distinct) {
          const seen = new Set()
          found = found.filter(row => { const key = JSON.stringify(query.distinct.map(key => row[key] ?? null)); if (seen.has(key)) return false; seen.add(key); return true })
        }
        if (query.cursor) found = found.slice(found.findIndex(row => row.id === query.cursor.id) + query.skip)
        return found.slice(0, query.take).map(row => ({ ...row, sender: people.get(row.senderId), recipient: people.get(row.recipientId), replyTo: query.include?.replyTo ? rows.find(parent => parent.id === row.replyToId) ?? null : undefined }))
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
test('trip references persist for both travelers and the inbox, with retry deduplication', async () => {
  const h = harness()
  const input = { ...h.input, itineraryId: 'trip', itineraryTitle: 'Forged title' }
  await h.sendDirectMessage(input)
  await h.sendDirectMessage(input)
  assert.equal(h.rows.length, 1)
  assert.equal(h.rows[0].itineraryId, 'trip')
  assert.equal(h.rows[0].itineraryTitle, 'Paris')
  assert.equal(h.rows[0].placeId, undefined)
  assert.equal(h.queries[0].visibility.not, 'draft')
  assert.equal((await h.getConversation('bob', undefined, 'trip')).messages[0].itineraryTitle, 'Paris')
  assert.equal((await h.getMessageInbox()).threads[0].itineraryTitle, 'Paris')
  const recipient = harness('bob')
  recipient.rows.push(...h.rows)
  assert.equal((await recipient.getConversation('alice', undefined, 'trip')).messages[0].itineraryId, 'trip')
})
test('unavailable or malformed trip references fail without sending an unlinked message', async () => {
  const h = harness()
  for (const itineraryId of ['deleted-or-draft', 123, {}]) {
    assert.ok((await h.sendDirectMessage({ ...h.input, itineraryId })).error)
  }
  assert.equal(h.rows.length, 0)
})
test('place attachments cannot be sent into a different trip thread', async () => {
  const h = harness()
  assert.ok((await h.sendDirectMessage({ ...h.input, placeId: 'cafe', itineraryId: 'other-trip' })).error)
  assert.equal(h.rows.length, 0)
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

test('replies quote the selected message and inherit its trip, including further replies', async () => {
  const h = harness()
  await h.sendDirectMessage({ ...h.input, itineraryId: 'trip' })
  h.rows.push({ id: 'other-trip', senderId: 'bob', recipientId: 'alice', content: 'What about Rome?', itineraryId: 'rome', itineraryTitle: 'Rome', createdAt: new Date(1000) })
  await h.sendDirectMessage({ ...h.input, content: 'Paris answer', replyToId: 'm0', clientId: 'paris-reply-123456' })
  await h.sendDirectMessage({ ...h.input, content: 'Rome answer', replyToId: 'other-trip', clientId: 'rome-reply-1234567' })
  await h.sendDirectMessage({ ...h.input, content: 'More on Paris', replyToId: 'm2', clientId: 'paris-followup-12345' })
  const { messages } = await h.getConversation('bob', undefined, 'trip')
  assert.equal(messages.length, 3)
  assert.equal(messages[1].replyTo.content, 'Hello')
  assert.equal(messages[1].itineraryTitle, 'Paris')
  assert.equal(messages[2].itineraryTitle, 'Paris')
  assert.equal((await h.getConversation('bob')).messages.length, 0)
  const recipient = harness('bob')
  recipient.rows.push(...h.rows)
  const rome = await recipient.getConversation('alice', undefined, 'rome')
  assert.equal(rome.messages.length, 2)
  assert.equal(rome.messages[1].replyTo.content, 'What about Rome?')
})

test('reply targets must exist in the same private conversation', async () => {
  const h = harness()
  h.rows.push({ id: 'secret', senderId: 'bob', recipientId: 'eve', content: 'private', createdAt: new Date() })
  h.rows.push({ id: 'different-thread', senderId: 'alice', recipientId: 'eve', content: 'also private', createdAt: new Date() })
  for (const replyToId of ['secret', 'different-thread', 'missing', 123]) {
    assert.ok((await h.sendDirectMessage({ ...h.input, replyToId })).error)
  }
  assert.equal(h.rows.length, 2)
})

test('replies preserve place references and deduplicate retries', async () => {
  const h = harness()
  await h.sendDirectMessage({ ...h.input, placeId: 'cafe' })
  const reply = { ...h.input, replyToId: 'm0', clientId: 'reply-client-123456' }
  await h.sendDirectMessage(reply)
  await h.sendDirectMessage(reply)
  assert.equal(h.rows.length, 2)
  assert.equal(h.rows[1].placeName, 'Cafe')
  assert.equal(h.rows[1].replyToId, 'm0')
})

test('inbox has one entry per person and trip, combining both directions only within that trip', async () => {
  const h = harness()
  await h.sendDirectMessage({ ...h.input, itineraryId: 'trip' })
  await h.sendDirectMessage({ ...h.input, clientId: 'general-client-1234' })
  h.rows.push({ id: 'rome', senderId: 'bob', recipientId: 'alice', itineraryId: 'rome', itineraryTitle: 'Rome', content: 'Rome question', createdAt: new Date(3000) })
  h.rows.push({ id: 'paris-reply', senderId: 'bob', recipientId: 'alice', itineraryId: 'trip', itineraryTitle: 'Paris', content: 'Paris answer', createdAt: new Date(4000) })
  const { threads } = await h.getMessageInbox()
  assert.equal(threads.length, 3)
  assert.deepEqual(Array.from(threads, t => t.itineraryId ?? null), ['trip', 'rome', null])
  assert.equal(threads[0].content, 'Paris answer')
  assert.equal((await h.getConversation('bob')).messages.length, 1)
  assert.equal((await h.getConversation('bob', undefined, 'trip')).messages.length, 2)
  assert.equal((await h.getConversation('bob', undefined, 'rome')).messages.length, 1)
})

test('trip threads reject other-trip cursors and reply targets, even for the same person', async () => {
  const h = harness()
  await h.sendDirectMessage({ ...h.input, itineraryId: 'trip' })
  h.rows.push({ id: 'rome', senderId: 'bob', recipientId: 'alice', itineraryId: 'rome', content: 'Rome', createdAt: new Date(2000) })
  assert.ok((await h.getConversation('bob', 'rome', 'trip')).error)
  assert.ok((await h.getConversation('bob', 'm0')).error)
  assert.ok((await h.sendDirectMessage({ ...h.input, clientId: 'invalid-reply-12345', itineraryId: 'trip', replyToId: 'rome' })).error)
  assert.equal(h.rows.length, 2)
})

test('ordinary follow-ups stay in the chosen trip and existing threads survive deleted trips', async () => {
  const h = harness()
  await h.sendDirectMessage({ ...h.input, placeId: 'cafe' })
  const sent = await h.sendDirectMessage({ ...h.input, clientId: 'followup-client-1234', itineraryId: 'trip', content: 'Thanks!' })
  assert.equal(sent.itineraryId, 'trip')
  assert.equal((await h.getConversation('bob', undefined, 'trip')).messages.length, 2)
  h.rows.push({ id: 'deleted-trip-message', senderId: 'bob', recipientId: 'alice', itineraryId: 'deleted', itineraryTitle: 'Old trip', content: 'Hi', createdAt: new Date(2000) })
  assert.ok((await h.sendDirectMessage({ ...h.input, clientId: 'deleted-followup-123', itineraryId: 'deleted' })).success)
  assert.equal(h.rows.at(-1).itineraryTitle, 'Old trip')
  assert.ok((await h.sendDirectMessage({ ...h.input, recipientId: 'eve', clientId: 'foreign-followup-123', itineraryId: 'deleted' })).error)
})
