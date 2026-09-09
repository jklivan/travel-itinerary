import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { eventPhotos, pickEventPhoto, tripPhotoGallery } from '../src/lib/eventPhotos.ts'

test('photo collections preserve legacy uploads and remove duplicate URLs', () => {
  assert.deepEqual(eventPhotos(undefined, '/legacy.jpg'), ['/legacy.jpg'])
  assert.deepEqual(eventPhotos(['/one.jpg', '/two.jpg', '/one.jpg', ' '], '/legacy.jpg'), ['/one.jpg', '/two.jpg'])
  assert.deepEqual(eventPhotos([], ''), [])
})

test('every event photo can be picked for the tile without changing the gallery', () => {
  const photos = ['/one.jpg', '/two.jpg', '/three.jpg']
  assert.equal(pickEventPhoto(photos, 0), '/one.jpg')
  assert.equal(pickEventPhoto(photos, 0.5), '/two.jpg')
  assert.equal(pickEventPhoto(photos, 0.99), '/three.jpg')
  assert.equal(pickEventPhoto([], 0), null)
  assert.deepEqual(photos, ['/one.jpg', '/two.jpg', '/three.jpg'])
})

test('trip gallery contains every event image and trip upload exactly once', () => {
  const result = tripPhotoGallery([
    { id: 'trip', url: '/one.jpg', caption: 'Trip' },
    { id: 'stock', url: '/stock.jpg', caption: null, isStock: true },
  ], [
    { id: 'hotel', name: 'Hotel', photoUrls: ['/one.jpg', '/two.jpg'] },
    { id: 'museum', name: 'Museum', photoUrl: '/legacy.jpg' },
  ])
  assert.deepEqual(result.map(photo => photo.url), ['/one.jpg', '/two.jpg', '/legacy.jpg'])
  assert.equal(result[1].caption, 'Hotel')
})

test('server saves all event photos for hotels, restaurants, activities, and legacy flat submissions', () => {
  const source = ts.createSourceFile('itinerary.ts', readFileSync(new URL('../src/actions/itinerary.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'flattenGroups')
  assert.ok(fn)
  const code = ts.transpileModule(fn.getText(source) + '\nflattenGroups(groups)', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const food = [{ name: 'Cafe', photos: ['/food1.jpg', '/food2.jpg'] }]
  const activities = [{ name: 'Museum', photos: ['/act1.jpg', '/act2.jpg'] }]
  for (const fields of [{ days: [{ food, activities }] }, { food, activities }]) {
    const groups = [{ hotelName: 'Hotel', hotelPhotos: ['/hotel1.jpg', '/hotel2.jpg'], ...fields }]
    const rows = vm.runInNewContext(code, { groups, eventPhotos })
    assert.deepEqual(Array.from(rows, row => Array.from(row.photoUrls)), [['/hotel1.jpg', '/hotel2.jpg'], ['/food1.jpg', '/food2.jpg'], ['/act1.jpg', '/act2.jpg']])
    assert.deepEqual(Array.from(rows, row => row.photoUrl), ['/hotel1.jpg', '/food1.jpg', '/act1.jpg'])
  }
})

test('multi-file upload appends successes, reports failures, and balances busy state', async () => {
  let changed
  const busy = []
  const states = []
  let finish
  const completed = new Promise(resolve => { finish = resolve })
  const code = ts.transpileModule(readFileSync(new URL('../src/components/EventPhotoInput.tsx', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const jsx = (type, props) => ({ type, props })
  const context = { exports: {}, crypto: { randomUUID: () => 'test' }, require: name => {
    if (name === 'react') return { useRef: value => ({ current: value }), useState: value => [value, next => states.push(next)] }
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (name === 'lucide-react') return {}
    if (name === '@/lib/eventPhotos') return { eventPhotos }
    if (name === '@vercel/blob/client') return { upload: async (_path, file) => {
      if (file.name === 'failed.jpg') throw new Error('Upload failed')
      return { url: `https://example.com/${file.name}` }
    } }
    throw new Error(`Unexpected dependency ${name}`)
  } }
  vm.runInNewContext(code, context)
  const tree = context.exports.default({ photos: ['/existing.jpg'], name: 'Museum', onChange: value => { changed = value }, onBusyChange: value => { busy.push(value); if (!value) finish() } })
  function find(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'input') return node
    for (const child of Array.isArray(node) ? node : [node.props?.children]) { const match = find(child); if (match) return match }
  }
  const input = find(tree)
  assert.equal(input.props.multiple, true)
  input.props.onChange({ target: { files: [{ name: 'one.jpg', size: 100 }, { name: 'failed.jpg', size: 100 }, { name: 'two.jpg', size: 100 }], value: 'files' } })
  await completed
  assert.deepEqual(Array.from(changed), ['/existing.jpg', '/api/img?url=https%3A%2F%2Fexample.com%2Fone.jpg', '/api/img?url=https%3A%2F%2Fexample.com%2Ftwo.jpg'])
  assert.deepEqual(busy, [true, false])
  assert.ok(states.some(value => typeof value === 'string' && value.startsWith('1 photo could not be added')))
})
