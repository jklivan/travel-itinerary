import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { eventPhotos } from '../src/lib/eventPhotos.ts'
import { getRecommendation, recommendationTags } from '../src/lib/placeRecommendation.ts'

function evaluateSourceNode(path, predicate, expression, values) {
  const source = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let matched
  function visit(node) {
    if (predicate(node)) matched = node
    else ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(matched, `Expected code in ${path}`)
  const code = ts.transpileModule(`${matched.getText(source)}\n${expression}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS },
  }).outputText
  const result = vm.runInNewContext(code, { ...values, eventPhotos, getRecommendation, recommendationTags })
  return JSON.parse(JSON.stringify(result))
}

test('guided creation saves hotel, restaurant and activity recommendation tags', () => {
  const items = [
    { id: 'hotel', type: 'hotel', name: 'Hotel', photo: '/hotel1.jpg', photos: ['/hotel1.jpg', '/hotel2.jpg'], dayIndex: 1, tags: ['Boutique'], isHighlight: true },
    { id: 'food', type: 'food_drink', name: 'Cafe', photo: '/cafe1.jpg', photos: ['/cafe1.jpg', '/cafe2.jpg'], dayIndex: 1, tags: ['Local Favorite', '__avoid'], isHighlight: false },
    { id: 'activity', type: 'activity', name: 'Tour', photo: '/tour1.jpg', photos: ['/tour1.jpg', '/tour2.jpg'], dayIndex: 1, tags: ['__highlight'], isHighlight: true },
  ]
  const result = evaluateSourceNode('../src/app/create/guided/page.tsx',
    node => ts.isFunctionDeclaration(node) && node.name?.text === 'buildDestinations',
    'buildDestinations()', { dests: [{ name: 'London', items }], curDest: { name: '' } })
  const group = result[0].groups[0]
  assert.deepEqual(group.hotelPhotos, ['/hotel1.jpg', '/hotel2.jpg'])
  assert.deepEqual(group.days[0].food[0].photos, ['/cafe1.jpg', '/cafe2.jpg'])
  assert.deepEqual(group.days[0].activities[0].photos, ['/tour1.jpg', '/tour2.jpg'])
  assert.deepEqual(group.hotelTags, ['Boutique', '__highlight'])
  assert.deepEqual(group.days[0].food[0].tags, ['Local Favorite', '__avoid'])
  assert.deepEqual(group.days[0].activities[0].tags, ['__highlight'])
})

test('standard creation keeps hotel stamps and activity Avoid selections in the submission', () => {
  const destinations = [{ groups: [{ hotelTags: ['__avoid'], days: [{
    food: [{ tags: ['Great Food'], isHighlight: true }],
    activities: [{ tags: ['__avoid'], isHighlight: false }, { isHighlight: true }],
  }] }] }]
  const result = evaluateSourceNode('../src/app/create/page.tsx',
    node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText() === 'submittableDests'),
    'submittableDests', { destinations })
  const group = result[0].groups[0]
  assert.deepEqual(group.hotelTags, ['__avoid'])
  assert.deepEqual(group.days[0].food[0].tags, ['Great Food', '__highlight'])
  assert.deepEqual(group.days[0].activities[0].tags, ['__avoid'])
  assert.deepEqual(group.days[0].activities[1].tags, ['__highlight'])
})
