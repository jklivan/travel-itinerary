import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.createSourceFile('page.tsx', readFileSync(new URL('../src/lib/importFiles.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
// fetchExtraction and the helpers it uses to pick up a reading after the app was in the background.
const wanted = ['fetchExtraction', 'trackHidden', 'pause', 'resumed']
const parts = []
function visit(node) {
  if ((ts.isFunctionDeclaration(node) && wanted.includes(node.name?.text)) || (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => wanted.includes(d.name.getText(source))))) parts.push(node.getText(source))
  ts.forEachChild(node, visit)
}
visit(source)
const compiled = ts.transpileModule(parts.join('\n') + '\nexports.fetchExtraction = fetchExtraction', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

// A page that can go into the background and come back.
function page() {
  const listeners = new Set()
  const doc = { visibilityState: 'visible', addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) }
  return { doc, listeners, set(state) { doc.visibilityState = state; for (const fn of [...listeners]) fn() } }
}

function harness(fetch, screen = page()) {
  const timers = new Map()
  let nextTimer = 0
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, fetch, AbortController, IMPORT_TIMEOUT_MS: 300000, document: screen.doc, crypto: { randomUUID: () => 'job-0000-test' }, Error, Promise,
    setTimeout: (callback, ms) => {
      const id = ++nextTimer
      if (ms === 750 || ms === 2500) queueMicrotask(callback)
      else timers.set(id, callback)
      return id
    },
    clearTimeout: id => timers.delete(id),
  })
  return { request: exports.fetchExtraction, timers }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
function delayedBody(signal) {
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
  })
}

test('timeout remains active after successful headers while the body is stalled', async () => {
  const h = harness(async (_, { signal }) => ({ ok: true, json: () => delayedBody(signal) }))
  const pending = h.request({ text: 'Paris trip' }, 'your pasted text')
  await tick()
  assert.equal(h.timers.size, 1, 'body parsing must remain protected by the timeout')
  const rejected = assert.rejects(pending, /Reading your pasted text timed out/)
  h.timers.values().next().value()
  await rejected
  assert.equal(h.timers.size, 0)
})

test('Cancel interrupts body reading after headers arrive', async () => {
  const controller = new AbortController()
  const h = harness(async (_, { signal }) => ({ ok: true, json: () => delayedBody(signal) }))
  const pending = h.request({ text: 'Paris trip' }, 'your pasted text', controller.signal)
  await tick()
  const rejected = assert.rejects(pending, /Import cancelled/)
  controller.abort()
  await rejected
  assert.equal(h.timers.size, 0)
})

test('an already cancelled import never starts a network request', async () => {
  const controller = new AbortController()
  controller.abort()
  let calls = 0
  const h = harness(async () => { calls++ })
  await assert.rejects(h.request({ text: 'Paris' }, 'notes', controller.signal), /Import cancelled/)
  assert.equal(calls, 0)
})

test('a truncated JSON response retries and cleans up timers', async () => {
  let calls = 0
  const expected = { destinations: [] }
  const h = harness(async () => ({ ok: true, json: async () => {
    if (++calls === 1) throw new Error('Truncated JSON')
    return expected
  } }))
  assert.equal(await h.request({ text: 'Paris' }), expected)
  assert.equal(calls, 2)
  assert.equal(h.timers.size, 0)
})

test('a result that arrives after cancellation is not applied', async () => {
  const controller = new AbortController()
  let finish
  const h = harness(async () => ({ ok: true, json: () => new Promise(resolve => { finish = resolve }) }))
  const pending = h.request({ text: 'Paris' }, 'notes', controller.signal)
  await tick()
  const rejected = assert.rejects(pending, /Import cancelled/)
  controller.abort()
  finish({ destinations: [] })
  await rejected
})

test('switching apps mid-reading: the lost answer is fetched from the saved result when the page comes back', async () => {
  const screen = page()
  const expected = { title: 'Italy', destinations: [] }
  let posts = 0, polls = 0
  const h = harness(async (url, { method, signal }) => {
    if (method === 'POST') {
      posts++
      // iOS freezes the page and the request's answer is lost.
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }))
    }
    assert.match(url, /\/api\/extract-pdf\?job=job-0000-test/)
    return { ok: true, json: async () => (++polls < 2 ? { status: 'pending' } : { status: 'done', result: expected }) }
  }, screen)
  const pending = h.request({ text: 'Italy notes' }, 'notes')
  await tick()
  screen.set('hidden'); screen.set('visible')
  assert.equal(await pending, expected)
  assert.equal(posts, 1); assert.equal(polls, 2)
  assert.equal(screen.listeners.size, 0, 'stops watching the page once settled')
})

test('a reading that never reached Postcard is sent again after coming back', async () => {
  const screen = page()
  let posts = 0
  const expected = { destinations: [] }
  const h = harness(async (_, { method }) => {
    if (method === 'POST') {
      if (++posts === 1) { screen.set('hidden'); throw new TypeError('Load failed') }
      return { ok: true, json: async () => expected }
    }
    return { ok: true, json: async () => ({ status: 'unknown' }) }
  }, screen)
  const pending = h.request({ text: 'Italy notes' }, 'notes')
  await tick()
  screen.set('visible')
  assert.equal(await pending, expected)
  assert.equal(posts, 2)
})
