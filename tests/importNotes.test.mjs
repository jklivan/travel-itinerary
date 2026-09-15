import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as crypto from 'node:crypto'
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const code = compile(readFileSync(new URL('../src/actions/importNotes.ts', import.meta.url), 'utf8'))
function harness(userId = 'alice', rows = []) {
  const prisma = { savedImportNotes: {
    upsert: async ({ where, create }) => {
      let row = rows.find(r => r.userId === where.userId_digest.userId && r.digest === where.userId_digest.digest)
      if (!row) { row = { id: `n${rows.length}`, createdAt: new Date(), ...create }; rows.push(row) }
      return { id: row.id }
    },
    findMany: async ({ where, take }) => rows.filter(r => r.userId === where.userId).slice(-take).reverse(),
    findFirst: async ({ where }) => rows.find(r => r.id === where.id && r.userId === where.userId),
  } }
  const dependencies = { 'node:crypto': crypto, '@/auth': { auth: async () => userId ? { user: { id: userId } } : null }, '@/lib/prisma': { prisma } }
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => dependencies[name] })
  return { ...exports, rows }
}
test('notes are persisted exactly and retries reuse the same account-owned backup', async () => {
  const h = harness()
  const original = '  Paris\nStay at Hotel X\nDinner at Y  '
  const a = await h.saveImportNotes(original)
  const b = await h.saveImportNotes(original)
  assert.equal(a.id, b.id)
  assert.equal(h.rows.length, 1)
  assert.equal((await h.getImportNotes(a.id)).text, original)
  assert.equal(h.rows[0].userId, 'alice')
})
test('other accounts cannot list or retrieve someone else’s notes', async () => {
  const h = harness()
  const saved = await h.saveImportNotes('Private travel details')
  const other = harness('bob', h.rows)
  assert.equal((await other.listImportNotes()).length, 0)
  assert.ok((await other.getImportNotes(saved.id)).error)
  const own = await other.saveImportNotes('Private travel details')
  assert.notEqual(own.id, saved.id)
})
test('anonymous or invalid requests do not create backups', async () => {
  const h = harness(null)
  assert.ok((await h.saveImportNotes('Paris')).error)
  assert.ok((await h.getImportNotes('any')).error)
  assert.equal((await h.listImportNotes()).length, 0)
  const signed = harness()
  for (const value of ['', '  ', null, 'a'.repeat(200001)]) assert.ok((await signed.saveImportNotes(value)).error)
  assert.equal(signed.rows.length, 0)
})
test('recovery listing returns previews, with full notes fetched only on selection', async () => {
  const h = harness()
  await h.saveImportNotes('x'.repeat(1000))
  const list = await h.listImportNotes()
  assert.equal(list[0].preview.length, 140)
  assert.equal(list[0].text, undefined)
})

const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../src/app/create/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let handler
function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'handlePasteExtract') handler = node; ts.forEachChild(node, visit) }
visit(page)
function flow(saveImportNotes, fetchExtraction) {
  const events = []
  const importAbortRef = { current: null }
  const context = { AbortController, pasteText: 'Trip notes', importAbortRef, saveImportNotes, fetchExtraction,
    setExtracting: v => events.push(['extracting', v]), setExtractError: v => events.push(['error', v]),
    setImportStage: v => events.push(['stage', v]), setSavedNotesVersion() {},
    applyExtractionResults: () => events.push(['applied']), setPasteMode() {}, setPasteText: v => events.push(['text', v]), exports: {} }
  vm.runInNewContext(compile(handler.getText(page) + '\nexports.run = handlePasteExtract'), context)
  return { run: context.exports.run, events, importAbortRef }
}
test('processing waits for durable save acknowledgement', async () => {
  let finishSave
  let extracted = false
  const h = flow(() => new Promise(resolve => { finishSave = resolve }), async () => { extracted = true; return {} })
  const pending = h.run()
  assert.equal(extracted, false)
  finishSave({ id: 'saved' })
  await pending
  assert.equal(extracted, true)
  assert.ok(h.events.some(e => e[0] === 'applied'))
})
test('a failed save stops processing and preserves pasted notes', async () => {
  let extracted = false
  const h = flow(async () => { throw new Error('offline') }, async () => { extracted = true })
  await h.run()
  assert.equal(extracted, false)
  assert.ok(h.events.some(e => e[0] === 'error' && e[1]?.includes('Could not save your notes')))
  assert.equal(h.events.some(e => e[0] === 'text'), false)
})
test('cancelling while saving keeps the backup and never starts extraction', async () => {
  let finishSave
  let extracted = false
  const h = flow(() => new Promise(resolve => { finishSave = resolve }), async () => { extracted = true })
  const pending = h.run()
  h.importAbortRef.current.abort()
  finishSave({ id: 'saved' })
  await pending
  assert.equal(extracted, false)
  assert.ok(h.events.some(e => e[0] === 'error' && e[1]?.includes('saved for later')))
  assert.equal(h.events.some(e => e[0] === 'text'), false)
})
