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
