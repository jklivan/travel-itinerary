// Actual React UI with stubbed server actions. Run: node tests/copyTrip.browser.mjs
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
const temp = await mkdtemp(path.join(tmpdir(), 'xen-copy-trip-'))
async function source(name, text) {
  await writeFile(path.join(temp, `${name}.js`), ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
}
const component = await readFile(path.join(root, 'src/components/CopyTripButton.tsx'), 'utf8')
await source('CopyTripButton', component)
await source('navigation', `const router = { push(url) { window.navigation = url }, refresh() {} }; export function useRouter() { return router }`)
await source('actions', `export async function copyTripToPlan(input) { window.attempts.push(input); if (window.failSave) throw Error('offline'); return { id: 'new-copy' } }`)
await source('entry', `
  import { createRoot } from 'react-dom/client'
  import CopyTripButton from './CopyTripButton'
  window.attempts = []
  const root = createRoot(document.getElementById('root'))
  window.renderCopy = (isOwn) => root.render(<CopyTripButton key={String(isOwn)} itineraryId="capri" title="Capri last summer" isOwn={isOwn} />)
  window.renderCopy(true)
`)
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: 'development', devtool: false, entry: path.join(temp, 'entry.js'), output: { path: temp, filename: 'bundle.js' }, resolve: { modules: [path.join(root, 'node_modules'), 'node_modules'], alias: {
    'next/navigation': path.join(temp, 'navigation.js'), '@/actions/copyTrip': path.join(temp, 'actions.js'),
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
  await page.route('https://copy-trip.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#F3EAD9"><div id="root"></div></body></html>' }))
  await page.goto('https://copy-trip.test/')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: path.join(temp, 'bundle.js') })
  await page.getByRole('button', { name: 'Copy trip', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Copy into a new plan' })
  assert.equal(await dialog.isVisible(), true)
  assert.equal(await page.getByRole('textbox', { name: 'New trip name' }).inputValue(), 'Capri last summer — next trip')
  assert.equal(await page.getByRole('checkbox', { name: 'Include my notes' }).isChecked(), true)
  await page.getByRole('textbox', { name: 'New trip name' }).fill('Capri this summer')
  await page.getByRole('checkbox', { name: 'Keep the day-by-day layout' }).uncheck()
  await page.getByRole('checkbox', { name: 'Include my notes' }).uncheck()
  for (const width of [320, 390, 1200]) {
    await page.setViewportSize({ width, height: 844 })
    const box = await dialog.boundingBox()
    assert.ok(box.width <= width && box.x >= 0 && box.x + box.width <= width)
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(temp, 'copy-trip-mobile.png') })
  await page.evaluate(() => { window.failSave = true })
  await page.getByRole('button', { name: 'Create private copy', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByRole('textbox', { name: 'New trip name' }).inputValue(), 'Capri this summer')
  await page.evaluate(() => { window.failSave = false })
  await page.getByRole('button', { name: 'Create private copy', exact: true }).click()
  await page.waitForFunction(() => window.navigation === '/plan/new-copy')
  const attempts = await page.evaluate(() => window.attempts)
  assert.equal(attempts.length, 2)
  assert.equal(attempts[0].clientId, attempts[1].clientId)
  assert.equal(attempts[1].keepDays, false); assert.equal(attempts[1].keepNotes, false)
  assert.equal(attempts[1].title, 'Capri this summer')
  assert.equal(await dialog.isVisible(), false)
  await page.evaluate(() => window.renderCopy(false))
  await page.getByRole('button', { name: 'Copy trip', exact: true }).click()
  assert.equal(await page.getByRole('checkbox', { name: 'Include my notes' }).count(), 0)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert.equal(await dialog.isVisible(), false)
  assert.equal(await page.evaluate(() => window.attempts.length), 2)
  await page.getByRole('button', { name: 'Copy trip', exact: true }).click()
  await page.getByRole('button', { name: 'Create private copy', exact: true }).click()
  await page.waitForFunction(() => window.attempts.length === 3)
  assert.equal((await page.evaluate(() => window.attempts[2])).keepNotes, false)
  assert.deepEqual(errors, [])
  console.log('Browser passed: own and other travelers trips, options, cancel, failed-send retry, mobile dialog and new-plan navigation.')
  console.log('Screenshot:', path.join(temp, 'copy-trip-mobile.png'))
} finally { await browser.close() }
