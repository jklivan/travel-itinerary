// Actual React UI with stubbed server actions. Run: node tests/planSuggestions.browser.mjs
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const { webpack } = require('next/dist/compiled/webpack/webpack')
const { compile } = require('@tailwindcss/node')
const root = path.resolve(import.meta.dirname, '..')
const temp = await mkdtemp(path.join(tmpdir(), 'xen-plan-browser-'))
async function source(name, text) {
  await writeFile(path.join(temp, `${name}.js`), ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
}
const component = await readFile(path.join(root, 'src/components/PlanFriendsBrowser.tsx'), 'utf8')
await source('PlanFriendsBrowser', component)
await source('identity', await readFile(path.join(root, 'src/lib/planPlaceIdentity.ts'), 'utf8'))
await source('navigation', `const router = { refresh() { window.refreshes++ } }; export function useRouter() { return router }`)
await source('link', `export default function Link(props) { return <a {...props} /> }`)
await source('actions', `
  const place = (id, name, city, extra = {}) => ({ id, name, type: 'activity', destination: { name: city, country: null }, alreadyAdded: false, ...extra })
  export const london = [
    { id: 'jen', author: 'Jen', title: 'London with Jen', places: [place('museum', 'Science Museum', 'London', { notes: 'Great for a rainy day.' }), place('park', 'Hyde Park', 'London', { alreadyAdded: true })] },
    { id: 'sam', author: 'Sam', title: 'Sam’s London weekend', places: [place('cafe', 'London Cafe', 'London', { type: 'food_drink' })] },
  ]
  const paris = [{ id: 'paris', author: 'Jen', title: 'Paris favorites', places: [place('paris-cafe', 'Paris Cafe', 'Paris', { type: 'food_drink' })] }]
  export async function findFriendsPlanPlaces(planId, query, before) {
    window.searches.push({ planId, query, before })
    const trips = query === 'Paris' ? paris : query === 'London' ? before ? [{ id: 'theo', author: 'Theo', title: 'Another London trip', places: [place('theatre', 'Theatre', 'London')] }] : london : []
    return { trips: trips.map(t => ({ ...t, places: t.places.map(p => ({ ...p, alreadyAdded: p.alreadyAdded || window.saved.includes(p.id) })) })), hasMore: query === 'London' && !before }
  }
  export async function copyPlacesToPlan(ids, planId) {
    window.attempts.push({ ids, planId })
    if (window.failSave) throw Error('offline')
    window.saved.push(...ids)
    return { added: ids.length, skipped: 0 }
  }
`)
await source('entry', `
  import { createRoot } from 'react-dom/client'
  import PlanFriendsBrowser from './PlanFriendsBrowser'
  import { london } from './actions'
  window.attempts = []; window.saved = []; window.searches = []; window.refreshes = 0
  createRoot(document.getElementById('root')).render(<PlanFriendsBrowser plan={{ id:'my-plan',title:'London w kids',destinations:[{name:'London'}] }} initialQuery="London" initialResults={{trips:london,hasMore:true}} />)
`)
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: 'development', devtool: false, entry: path.join(temp, 'entry.js'), output: { path: temp, filename: 'bundle.js' }, resolve: { modules: [path.join(root, 'node_modules'), 'node_modules'], alias: {
    'next/navigation': path.join(temp, 'navigation.js'), 'next/link': path.join(temp, 'link.js'), '@/lib/planPlaceIdentity': path.join(temp, 'identity.js'), '@/actions/planSuggestions': path.join(temp, 'actions.js'),
  } } })
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()))
})
const css = (await compile('@import "tailwindcss";', { base: root, onDependency() {} })).build(component.split(/[\s"'`{}<>]+/))
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://plan-browser.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#F3EAD9"><div id="root"></div></body></html>' }))
  await page.goto('https://plan-browser.test/')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: path.join(temp, 'bundle.js') })
  const search = page.getByRole('textbox', { name: 'City or destination' })
  assert.equal(await search.inputValue(), 'London')
  assert.equal(await page.getByRole('checkbox', { name: /Hyde Park/ }).isDisabled(), true)
  await page.getByRole('checkbox', { name: /Science Museum/ }).check()
  await page.getByText('Read Jen’s notes', { exact: true }).click()
  assert.equal(await page.getByText('Great for a rainy day.').isVisible(), true)
  await page.locator('summary').filter({ hasText: 'Sam’s London weekend' }).click()
  await page.getByRole('checkbox', { name: /London Cafe/ }).check()
  const add = page.getByRole('button', { name: 'Add 2 places to your plan', exact: true })
  assert.equal(await add.isVisible(), true)
  for (const width of [320, 390, 1200]) {
    await page.setViewportSize({ width, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const box = await add.boundingBox()
    assert.ok(box.y >= 0 && box.y + box.height < 844, 'bulk action stays visible')
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(temp, 'mobile-selection.png'), fullPage: true })
  await page.getByRole('button', { name: 'More friends’ trips', exact: true }).click()
  await page.getByText('Another London trip', { exact: true }).waitFor()
  assert.equal((await page.evaluate(() => window.searches[0])).before, 'sam')
  await search.fill('Paris')
  await page.getByRole('button', { name: 'Find trips', exact: true }).click()
  await page.getByRole('button', { name: 'Select all in this trip', exact: true }).click()
  await page.getByRole('button', { name: 'Add 3 places to your plan', exact: true }).waitFor()
  await search.fill('Rome')
  await page.getByRole('button', { name: 'Find trips', exact: true }).click()
  await page.getByText(/No matching trips/).waitFor()
  await page.evaluate(() => { window.failSave = true })
  await page.getByRole('button', { name: 'Add 3 places to your plan', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Add 3 places to your plan', exact: true }).isVisible(), true)
  await page.evaluate(() => { window.failSave = false })
  await page.getByRole('button', { name: 'Add 3 places to your plan', exact: true }).click()
  await page.getByRole('status').waitFor()
  assert.match(await page.getByRole('status').innerText(), /3 places added to London w kids/)
  assert.deepEqual(await page.evaluate(() => window.saved), ['museum', 'cafe', 'paris-cafe'])
  assert.equal(await page.evaluate(() => window.refreshes), 1)
  assert.equal(page.url(), 'https://plan-browser.test/')
  await search.fill('Paris')
  await page.getByRole('button', { name: 'Find trips', exact: true }).click()
  await page.getByRole('checkbox', { name: /Paris Cafe/ }).waitFor()
  assert.equal(await page.getByRole('checkbox', { name: /Paris Cafe/ }).isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log('Browser passed: cross-trip/search selections, pagination, notes, duplicate markers, failure retry, mobile layout, and staying in the browser after adding.')
  console.log('Screenshot:', path.join(temp, 'mobile-selection.png'))
} finally { await browser.close() }
