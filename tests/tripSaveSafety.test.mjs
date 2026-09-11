import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { tripDetailsError } from '../src/lib/tripDates.ts'

function source(path) { return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
function find(root, predicate) { if (predicate(root)) return root; return ts.forEachChild(root, n => find(n, predicate)) }
function run(code, context) { return vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context) }
const guided = source('../src/app/create/guided/page.tsx')

test('switching to an earlier city preserves the active city and original order', () => {
  const names = ['destinationsWithCurrent', 'editDest', 'finishDest']
  const code = names.map(name => find(guided, n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(guided)).join('\n')
  const state = { dests: [{ id: 'london', name: 'London', items: [], notes: '' }], curDest: { name: 'Paris', country: 'France' }, curItems: [{ name: 'Cafe', dayIndex: 1 }], curNotes: 'Paris notes', editingDestIndex: null }
  let id = 0
  for (const [field, setter] of Object.entries({ dests: 'setDests', curDest: 'setCurDest', curItems: 'setCurItems', curNotes: 'setCurNotes', editingDestIndex: 'setEditingDestIndex' })) state[setter] = value => { state[field] = value }
  Object.assign(state, { uid: () => String(++id), setCurDayIndex() {}, setActiveInput() {}, setEditingItemId() {}, setPhase() {} })
  run(code + '\neditDest("london")', state)
  assert.equal(state.curDest.name, 'London')
  assert.equal(state.dests[0].name, 'Paris')
  assert.equal(state.dests[0].items[0].name, 'Cafe')
  run(code + '\nfinishDest()', state)
  assert.deepEqual(Array.from(state.dests, d => d.name), ['London', 'Paris'])
})

test('guided save keeps recovery draft on validation/network failure and clears only on success', async () => {
  const hook = find(guided, n => ts.isCallExpression(n) && n.expression.getText(guided) === 'useActionState')
  for (const mode of ['validation', 'network', 'success']) {
    let removed = false; let destination
    const result = await run(`(${hook.arguments[0].getText(guided)})(undefined, data)`, {
      data: new FormData(), SESSION_KEY: 'draft', sessionStorage: { removeItem() { removed = true } }, window: { location: { assign(url) { destination = url } } },
      createItinerary: async () => { if (mode === 'network') throw Error('offline'); return mode === 'success' ? { itineraryId: 'saved-trip' } : { error: 'Title required' } },
    })
    assert.equal(removed, mode === 'success')
    if (mode === 'success') assert.equal(destination, '/itinerary/saved-trip')
    else assert.ok(result.error)
  }
})

test('standard save recovers from a rejected request and allows retry', async () => {
  const src = source('../src/app/create/page.tsx')
  const fn = find(src, n => ts.isFunctionDeclaration(n) && n.name?.text === 'handleSubmit')
  let pending = false; let error
  const context = { setPending: value => { pending = value }, setFormError: value => { error = value }, destinations: [], dateRangeFromMonthAndDays: () => ({}), tripMonth: '2026-09', tripDays: '3', tripDetailsError, title: 'Trip', description: '', notes: '', computedHighlightNames: [], photos: [], tags: [], tripRating: null, postType: 'itinerary', tripAudience: 'family', createItineraryDirect: async () => { throw Error('offline') } }
  await run(fn.getText(src) + '\nhandleSubmit(false)', context)
  assert.equal(pending, false)
  assert.match(error, /try again/)
  context.createItineraryDirect = async () => ({ error: 'Title required' })
  await run(fn.getText(src) + '\nhandleSubmit(false)', context)
  assert.equal(pending, false)
  assert.equal(error, 'Title required')
})

test('failed itinerary replacement rolls back old destinations and photos', async () => {
  const src = source('../src/actions/itinerary.ts')
  const fn = find(src, n => ts.isFunctionDeclaration(n) && n.name?.text === 'updateItinerary')
  let original = { destinations: ['original place'], photos: ['original photo'] }
  let transactionUsed = false
  const context = {
    id: 'trip', state: undefined, data: new FormData(), auth: async () => ({ user: { id: 'owner' } }),
    parseFormData: () => ({ title: 'Trip', isDraft: true, startDateStr: '', endDateStr: '', destinations: [], photos: [] }),
    prisma: {
      itinerary: { findUnique: async () => ({ userId: 'owner' }) },
      $transaction: async callback => {
        transactionUsed = true
        const staged = structuredClone(original)
        await callback({ destination: { deleteMany: async () => { staged.destinations = [] } }, photo: { deleteMany: async () => { staged.photos = [] } }, itinerary: { update: async () => { throw Error('write failed') } } })
        original = staged
      },
    },
  }
  const result = await run(fn.getText(src).replace('export ', '') + '\nupdateItinerary(id, state, data)', context)
  assert.equal(transactionUsed, true)
  assert.match(result.error, /unchanged/)
  assert.deepEqual(original, { destinations: ['original place'], photos: ['original photo'] })
})

test('editing saves selected months, allows clearing, and preserves months from older forms', async () => {
  const src = source('../src/actions/itinerary.ts')
  const fn = find(src, n => ts.isFunctionDeclaration(n) && n.name?.text === 'updateItinerary')
  for (const selected of [['May', 'Sep'], [], null]) {
    const data = new FormData()
    if (selected !== null) data.set('bestMonths', JSON.stringify(selected))
    let saved
    await run(fn.getText(src).replace('export ', '') + '\nupdateItinerary("trip", undefined, data)', {
      data, auth: async () => ({ user: { id: 'owner' } }),
      parseFormData: () => ({ title: 'Trip', isDraft: true, destinations: [], photos: [], bestMonths: selected ?? [] }),
      prisma: { itinerary: { findUnique: async () => ({ userId: 'owner', bestMonths: ['Jun'] }) }, $transaction: async callback => callback({ destination: { deleteMany: async () => {} }, photo: { deleteMany: async () => {} }, itinerary: { update: async ({ data }) => { saved = data.bestMonths; throw Error('Stop before enrichment') } } }) },
    })
    assert.deepEqual(saved, selected ?? ['Jun'])
  }
})
