import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file, deps = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, URLSearchParams, require: name => name === 'react/jsx-runtime' ? require(name) : deps[name] })
  return exports
}
const hrefs = load('../src/lib/messageThread.ts')
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object') return []
  return [node, ...nodes(node.props?.children)]
}
const common = {
  '@/actions/questions': { getForumReplyInbox: async () => [] }, '@/actions/notifications': { openNotification() {} },
  'next/link': 'a', 'next/navigation': { notFound() { throw Error('notFound') }, redirect(path) { throw Error(`redirect:${path}`) } },
  '@/lib/messageThread': hrefs, '@/components/MessageRefresh': 'message-refresh', '@/components/MessageThread': 'message-thread', '@/components/MarkMessagesRead': 'mark-read',
  '@/auth': { auth: async () => ({ user: { id: 'me' } }) },
}
test('inbox presents separate links for two trips with the same person and general messages', async () => {
  const Inbox = load('../src/app/messages/page.tsx', { ...common, '@/actions/messages': { getMessageInbox: async () => ({ threads: [
    { person: { id: 'jen', name: 'Jen' }, itineraryId: 'london', itineraryTitle: 'London', content: 'London question', createdAt: new Date() },
    { person: { id: 'jen', name: 'Jen' }, itineraryId: 'capri', itineraryTitle: 'Capri', content: 'Capri question', createdAt: new Date() },
    { person: { id: 'jen', name: 'Jen' }, itineraryId: null, content: 'Hello', createdAt: new Date() },
  ] }) } }).default
  const rendered = nodes(await Inbox())
  assert.deepEqual(rendered.filter(n => n.type === 'a').map(n => n.props.href), ['/messages/jen?trip=london', '/messages/jen?trip=capri', '/messages/jen'])
  assert.ok(rendered.some(n => n.props?.children === 'General conversation'))
})
test('trip and place entry points filter reads and keep the selected trip through pagination and composing', async () => {
  for (const search of [{ trip: 'london', before: 'older' }, { place: 'museum' }]) {
    const calls = []
    const Page = load('../src/app/messages/[id]/page.tsx', { ...common,
      '@/lib/prisma': { prisma: {
        user: { findUnique: async () => ({ id: 'jen', name: 'Jen' }) },
        destItem: { findFirst: async () => ({ id: 'museum', name: 'Museum', destination: { itinerary: { id: 'london', title: 'London with kids' } } }) },
        itinerary: { findFirst: async () => ({ id: 'london', title: 'London with kids' }) },
      } },
      '@/actions/messages': { getConversation: async (...args) => { calls.push(args); return { messages: [{ id: 'london-message', recipientId: 'me' }], hasOlder: true } } },
    }).default
    const rendered = nodes(await Page({ params: Promise.resolve({ id: 'jen' }), searchParams: Promise.resolve(search) }))
    assert.equal(calls[0][2], 'london')
    const composer = rendered.find(n => n.type === 'message-thread')
    assert.equal(composer.props.itineraryId, 'london')
    assert.equal(composer.props.attachment?.id, search.place)
    const earlier = rendered.find(n => n.type === 'a' && n.props.children === 'Earlier messages')
    assert.match(earlier.props.href, /trip=london/)
    assert.match(earlier.props.href, /before=london-message/)
    assert.deepEqual(rendered.find(n => n.type === 'mark-read').props.messageIds, ['london-message'])
  }
})
test('thread URLs encode identifiers without mixing trips into the person ID', () => {
  assert.equal(hrefs.messageThreadHref('person/id', 'trip?one'), '/messages/person%2Fid?trip=trip%3Fone')
  assert.equal(hrefs.messageThreadHref('jen', null), '/messages/jen')
})


test('forum replies coexist with trip-specific private conversations in Messages', async () => {
  const openNotification = () => {}
  const Inbox = load('../src/app/messages/page.tsx', { ...common,
    '@/actions/questions': { getForumReplyInbox: async () => [{ id: 'reply', question: { id: 'question', content: 'Where should we stay?' }, author: { name: 'Jen' }, content: 'Try Capri', notification: { id: 'alert', readAt: null } }] },
    '@/actions/notifications': { openNotification },
    '@/actions/messages': { getMessageInbox: async () => ({ threads: [{ person: { id: 'jen', name: 'Jen' }, itineraryId: 'capri', itineraryTitle: 'Capri', content: 'Private answer', createdAt: new Date() }] }) },
  }).default
  const rendered = nodes(await Inbox())
  assert.ok(rendered.some(n => n.props?.children === 'Where should we stay?'))
  assert.ok(rendered.some(n => n.type === 'form' && n.props.action === openNotification))
  assert.ok(rendered.some(n => n.type === 'input' && n.props.value === 'alert'))
  assert.ok(rendered.some(n => n.type === 'a' && n.props.href === '/messages/jen?trip=capri'))
})
