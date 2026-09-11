import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as photos from '../src/lib/eventPhotos.ts'
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
    if (name === '@/lib/eventPhotos') return photos
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
    const props = () => ({ type: item.type, initial: item, onClose: () => { closed = true }, onSave: () => saves++, onPhotosChange() {}, onPhotoBusyChange() {}, onRecommendationChange: value => { item = { ...item, tags: recommendations.recommendationTags(item.tags, value), isHighlight: value === 'must' } } })
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

for (const path of ['../src/app/itinerary/[id]/edit/EditForm.tsx', '../src/app/create/guided/page.tsx']) {
  test(`${path}: restaurant notes accept and save multiple lines`, () => {
    const ui = editor(path)
    let saved
    const props = { type: 'food_drink', initial: { type: 'food_drink', name: 'Cafe', mealType: '', rating: 4, notes: '', tags: [], isHighlight: false, description: '', link: '', address: '', alternative: '', photos: [], photo: '', placeId: '' }, onClose() {}, onSave(value) { saved = value }, onPhotosChange() {}, onPhotoBusyChange() {}, onRecommendationChange() {} }
    let tree = ui.render(props)
    const notes = find(tree, node => node.type === 'textarea' && node.props['aria-label'] === 'Notes')
    assert.ok(notes, 'Notes must use a multiline textarea')
    notes.props.onChange({ target: { value: 'Great pasta\nBook ahead' } })
    tree = ui.render(props)
    const save = find(tree, node => node.type === 'button' && JSON.stringify(node.props.children).includes(' Save'))
    assert.ok(save)
    save.props.onClick()
    assert.equal(saved.notes, 'Great pasta\nBook ahead')
  })
}

for (const path of ['../src/app/itinerary/[id]/edit/EditForm.tsx', '../src/app/create/guided/page.tsx']) {
  test(`${path}: open event edits reach trip draft immediately and Cancel restores original`, () => {
    const ui = editor(path)
    let item = { type: 'food_drink', name: 'Cafe', mealType: '', rating: 4, notes: 'Original', tags: [], isHighlight: false, description: '', link: '', address: '', alternative: '', photos: [], photo: '', placeId: '' }
    let innerSaves = 0
    const props = () => ({ type: item.type, initial: item, onDraftChange(update) { item = { ...item, ...update } }, onSave() { innerSaves++ }, onClose() {}, onPhotosChange() {}, onPhotoBusyChange() {}, onRecommendationChange(value) { item = { ...item, tags: recommendations.recommendationTags(item.tags, value), isHighlight: value === 'must' } } })
    let tree = ui.render(props())
    find(tree, n => n.type === 'textarea' && n.props['aria-label'] === 'Notes').props.onChange({ target: { value: 'First line\nSecond line' } })
    tree = ui.render(props())
    find(tree, n => n.type === ui.picker).props.onChange('option')
    assert.equal(item.notes, 'First line\nSecond line')
    assert.equal(recommendations.getRecommendation(item.tags), 'option')
    assert.equal(innerSaves, 0)
    tree = ui.render(props())
    find(tree, n => n.type === 'button' && n.props.children === 'Cancel').props.onClick()
    assert.equal(item.notes, 'Original')
    assert.equal(recommendations.getRecommendation(item.tags), 'none')
  })
}
