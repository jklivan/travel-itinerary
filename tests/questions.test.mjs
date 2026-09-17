import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function moduleAt(path, dependencies = {}) {
  const exports = {}
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { exports, require: name => dependencies[name] })
  return exports
}

function harness() {
  let userId = 'alice'
  const questions = [], replies = [], follows = [], notifications = [], scheduled = []
  const trips = [{ id: 'paris', title: 'Paris with kids', visibility: 'public', user: { name: 'Jen' } }, { id: 'draft', title: 'Secret', visibility: 'draft' }]
  const relationMatches = (row, filter) => {
    if (filter.authorId) return row.authorId === filter.authorId
    const some = filter.author.following.some
    return follows.some(f => f.followerId === row.authorId && f.followingId === some.followingId && f.status === some.status)
  }
  const matches = (row, where) => (!where.question || questions.find(q => q.id === row.questionId)?.authorId === where.question.authorId) && (!where.authorId?.not || row.authorId !== where.authorId.not) && (!where.id || row.id === where.id) && (!where.questionId || row.questionId === where.questionId) && (!where.OR || where.OR.some(filter => relationMatches(row, filter)))
  const model = (rows, prefix) => ({
    findFirst: async ({ where }) => rows.find(row => matches(row, where)) ?? null,
    findMany: async ({ where, cursor, skip = 0, take }) => {
      let found = rows.filter(row => matches(row, where)).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
      if (cursor) found = found.slice(found.findIndex(row => row.id === cursor.id) + skip)
      return found.slice(0, take).map(row => ({ ...row, author: { id: row.authorId, name: row.authorId }, _count: { replies: replies.filter(r => r.questionId === row.id).length } }))
    },
    upsert: async ({ create }) => {
      let row = rows.find(r => r.authorId === create.authorId && r.clientId === create.clientId)
      if (!row) { row = { id: `${prefix}${rows.length}`, createdAt: new Date(rows.length * 1000), ...create }; rows.push(row) }
      return row
    },
  })
  const prisma = {
    follow: { findMany: async ({ where }) => follows.filter(f => f.followerId === where.followerId && f.status === where.status && f.followingId !== where.followingId.not) },
    notification: { createManyAndReturn: async ({ data }) => data.flatMap(row => {
      if (notifications.some(n => n.dedupeKey === row.dedupeKey)) return []
      const saved = { ...row, id: `n${notifications.length}` }; notifications.push(saved); return [saved]
    }) },
    friendQuestion: model(questions, 'q'), friendQuestionReply: model(replies, 'r'),
    itinerary: {
      findFirst: async ({ where }) => trips.find(t => t.id === where.id && t.visibility !== where.visibility.not),
      findMany: async ({ where }) => trips.filter(t => t.visibility !== where.visibility.not && (where.id ? t.id === where.id : t.title.toLowerCase().includes(where.title.contains.toLowerCase()))),
    },
  }
  prisma.$transaction = callback => callback(prisma)
  const actions = moduleAt('../src/actions/questions.ts', {
    '@/lib/notifications': moduleAt('../src/lib/notifications.ts'), 'next/server': { after: callback => scheduled.push(callback) }, '@/lib/push': { deliverNotification: async () => {} },
    '@/auth': { auth: async () => userId ? { user: { id: userId } } : null },
    '@/lib/prisma': { prisma }, '@/lib/friendQuestions': moduleAt('../src/lib/friendQuestions.ts'), 'next/cache': { revalidatePath() {} },
  })
  return { ...actions, questions, replies, follows, notifications, scheduled, signIn: id => { userId = id }, input: { content: 'Where should we stay?', clientId: 'question-client-123456' } }
}

test('all question operations require authentication', async () => {
  const h = harness(); h.signIn(null)
  for (const response of [await h.getFriendQuestions(), await h.getFriendQuestion('q0'), await h.createFriendQuestion(h.input), await h.replyToFriendQuestion('q0', h.input)]) assert.ok(response.error)
  assert.equal((await h.searchQuestionItineraries('Paris')).length, 0)
  assert.equal(h.questions.length + h.replies.length, 0)
})

test('only author and people the author follows can list, read, and reply', async () => {
  const h = harness()
  await h.createFriendQuestion(h.input)
  h.follows.push({ followerId: 'alice', followingId: 'bob', status: 'accepted' })
  h.follows.push({ followerId: 'eve', followingId: 'alice', status: 'accepted' })
  h.follows.push({ followerId: 'alice', followingId: 'pending', status: 'pending' })
  for (const viewer of ['alice', 'bob']) {
    h.signIn(viewer)
    assert.equal((await h.getFriendQuestions()).questions.length, 1)
    assert.ok((await h.getFriendQuestion('q0')).question)
    assert.ok((await h.replyToFriendQuestion('q0', h.input)).id)
  }
  for (const viewer of ['eve', 'pending', 'stranger']) {
    h.signIn(viewer)
    assert.equal((await h.getFriendQuestions()).questions.length, 0)
    assert.ok((await h.getFriendQuestion('q0')).error)
    assert.ok((await h.replyToFriendQuestion('q0', h.input)).error)
  }
  assert.equal(h.replies.length, 2)
  h.follows.length = 0
  h.signIn('bob')
  assert.ok((await h.getFriendQuestion('q0')).error)
  assert.ok((await h.replyToFriendQuestion('q0', h.input)).error)
})

test('question and reply attachments use database titles and retries do not duplicate posts', async () => {
  const h = harness()
  const input = { ...h.input, itineraryId: 'paris', itineraryTitle: 'forged', authorId: 'eve' }
  await h.createFriendQuestion(input); await h.createFriendQuestion(input)
  await h.replyToFriendQuestion('q0', input); await h.replyToFriendQuestion('q0', input)
  assert.equal(h.questions.length, 1); assert.equal(h.replies.length, 1)
  for (const row of [h.questions[0], h.replies[0]]) {
    assert.equal(row.itineraryTitle, 'Paris with kids'); assert.equal(row.authorId, 'alice')
  }
  assert.equal((await h.getFriendQuestions()).questions[0]._count.replies, 1)
})

test('invalid text and missing, draft, or malformed itinerary references cannot be posted', async () => {
  const h = harness()
  await h.createFriendQuestion(h.input)
  for (const change of [{ content: ' ' }, { content: 'x'.repeat(4001) }, { clientId: 'bad' }, { itineraryId: 'draft' }, { itineraryId: 'missing' }, { itineraryId: 12 }]) {
    assert.ok((await h.createFriendQuestion({ ...h.input, ...change })).error)
    assert.ok((await h.replyToFriendQuestion('q0', { ...h.input, ...change })).error)
  }
  assert.equal(h.questions.length, 1); assert.equal(h.replies.length, 0)
  assert.equal((await h.searchQuestionItineraries('Secret')).length, 0)
  assert.equal((await h.searchQuestionItineraries('Paris'))[0].id, 'paris')
  assert.equal((await h.searchQuestionItineraries('https://example.com/itinerary/paris?view=places'))[0].id, 'paris')
})

test('question pagination preserves all results and rejects private cursors', async () => {
  const h = harness()
  for (let i = 0; i < 25; i++) await h.createFriendQuestion({ ...h.input, clientId: `question-client-${i}` })
  const first = await h.getFriendQuestions()
  const next = await h.getFriendQuestions(first.questions.at(-1).id)
  assert.equal(first.questions.length, 20); assert.equal(first.hasMore, true)
  assert.equal(next.questions.length, 5); assert.equal(next.hasMore, false)
  assert.equal(new Set([...first.questions, ...next.questions].map(q => q.id)).size, 25)
  h.signIn('eve')
  assert.ok((await h.getFriendQuestions(first.questions[0].id)).error)
})

test('reply pagination preserves discussion order and rejects cursors from other questions', async () => {
  const h = harness()
  await h.createFriendQuestion(h.input)
  await h.createFriendQuestion({ ...h.input, clientId: 'other-question-12345' })
  for (let i = 0; i < 55; i++) await h.replyToFriendQuestion('q0', { ...h.input, clientId: `reply-client-${i}-12345`, content: String(i) })
  await h.replyToFriendQuestion('q1', { ...h.input, clientId: 'foreign-reply-12345' })
  const latest = await h.getFriendQuestion('q0')
  const older = await h.getFriendQuestion('q0', latest.replies[0].id)
  assert.equal(latest.replies.length, 50); assert.equal(latest.hasOlder, true)
  assert.equal(older.replies.length, 5); assert.equal(older.hasOlder, false)
  assert.equal(older.replies[0].content, '0')
  assert.equal(new Set([...latest.replies, ...older.replies].map(r => r.id)).size, 55)
  assert.ok((await h.getFriendQuestion('q0', 'r55')).error)
})


test('forum alerts reach only accepted audience members once and link to the new post', async () => {
  const h = harness()
  h.follows.push({ followerId: 'alice', followingId: 'bob', status: 'accepted' }, { followerId: 'alice', followingId: 'pending', status: 'pending' }, { followerId: 'eve', followingId: 'alice', status: 'accepted' })
  const result = await h.createFriendQuestion(h.input)
  await h.createFriendQuestion(h.input)
  assert.equal(h.notifications.length, 1)
  assert.equal(h.notifications[0].recipientId, 'bob')
  assert.equal(h.notifications[0].questionId, result.id)
  assert.equal(h.notifications[0].kind, 'forum')
  assert.equal(h.scheduled.length, 1)
  await h.replyToFriendQuestion(result.id, { ...h.input, clientId: 'different-reply-12345' })
  assert.equal(h.notifications.length, 1)
})


test('forum replies notify the question author exactly once and keep their public discussion', async () => {
  const h = harness()
  h.follows.push({ followerId: 'alice', followingId: 'bob', status: 'accepted' })
  const question = await h.createFriendQuestion(h.input)
  h.signIn('bob')
  const input = { content: 'Try this hotel', clientId: 'forum-reply-client-12345' }
  const reply = await h.replyToFriendQuestion(question.id, input)
  await h.replyToFriendQuestion(question.id, input)
  const notifications = h.notifications.filter(n => n.kind === 'forum_reply')
  assert.equal(h.replies.length, 1)
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].recipientId, 'alice')
  assert.equal(notifications[0].actorId, 'bob')
  assert.equal(notifications[0].questionId, question.id)
  assert.equal(notifications[0].questionReplyId, reply.id)
  assert.equal(h.scheduled.length, 2)
  h.signIn('alice')
  assert.equal((await h.getForumReplyInbox()).length, 1)
  await h.replyToFriendQuestion(question.id, { ...input, clientId: 'self-reply-client-12345' })
  assert.equal(h.notifications.filter(n => n.kind === 'forum_reply').length, 1)
  assert.equal((await h.getForumReplyInbox()).length, 1)
  h.signIn('eve')
  assert.equal((await h.getForumReplyInbox()).length, 0)
  h.signIn(null)
  assert.equal((await h.getForumReplyInbox()).length, 0)
})
