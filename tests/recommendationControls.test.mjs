import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as recommendations from '../src/lib/placeRecommendation.ts'
const require = createRequire(import.meta.url)

function editor(path) {
  const hooks = []; let cursor = 0
  const picker = Symbol('RecommendationPicker')
  const jsx = (type, props) => ({ type, props })
  const context = { exports: {}, require: name => {
    if (name === 'react') return { ...require(name), useState: initial => {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
    } }
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (name === '@/components/RecommendationPicker') return { default: picker }
    if (name === '@/lib/placeRecommendation') return recommendations
    return name.startsWith('@/') ? {} : require(name)
  } }
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source + '\nexport { ItemEditForm };', { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, context)
  return { picker, render(props) { cursor = 0; return context.exports.ItemEditForm(props) } }
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return
  if (predicate(node)) return node
  const children = Array.isArray(node) ? node : [node.props?.children]
  for (const child of children) { const found = find(child, predicate); if (found) return found }
}
for (const path of ['../src/app/itinerary/[id]/edit/EditForm.tsx', '../src/app/create/guided/page.tsx']) {
  test(`${path}: stamp click updates parent immediately; Cancel restores previous recommendation`, () => {
    const ui = editor(path)
    let item = { type: 'activity', name: 'Museum', mealType: '', rating: 5, notes: 'Original notes', tags: ['Cultural', '__avoid'], isHighlight: false, description: '', link: '', address: '', alternative: '', photo: '', placeId: '' }
    let saves = 0; let closed = false
    const props = () => ({ type: item.type, initial: item, onClose: () => { closed = true }, onSave: () => saves++, onRecommendationChange: value => { item = { ...item, tags: recommendations.recommendationTags(item.tags, value), isHighlight: value === 'must' } } })
    let tree = ui.render(props())
    find(tree, node => node.type === ui.picker).props.onChange('must')
    assert.equal(recommendations.getRecommendation(item.tags, item.isHighlight), 'must')
    assert.equal(saves, 0, 'No inner event Save required')
    tree = ui.render(props())
    assert.equal(find(tree, node => node.type === ui.picker).props.value, 'must')
    find(tree, node => node.type === 'button' && node.props.children === 'Cancel').props.onClick()
    assert.equal(recommendations.getRecommendation(item.tags, item.isHighlight), 'avoid')
    assert.deepEqual(item.tags, ['Cultural', '__avoid'])
    assert.equal(closed, true)
  })
}
