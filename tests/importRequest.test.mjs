import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.createSourceFile('page.tsx', readFileSync(new URL('../src/lib/importFiles.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let fn
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'fetchExtraction') fn = node
  ts.forEachChild(node, visit)
}
visit(source)
const compiled = ts.transpileModule(fn.getText(source) + '\nexports.fetchExtraction = fetchExtraction', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

function harness(fetch) {
  const timers = new Map()
  let nextTimer = 0
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, fetch, AbortController, IMPORT_TIMEOUT_MS: 300000,
    setTimeout: (callback, ms) => {
      const id = ++nextTimer
      if (ms === 750) queueMicrotask(callback)
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
