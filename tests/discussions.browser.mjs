// Browser checks for the actual React components, with server actions stubbed.
// Run: node tests/discussions.browser.mjs
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const { webpack } = require('next/dist/compiled/webpack/webpack')
const root = path.resolve(import.meta.dirname, '..')
const temp = await mkdtemp(path.join(tmpdir(), 'xen-discussions-'))
async function source(name, text) {
  const compiled = ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  await writeFile(path.join(temp, `${name}.js`), compiled)
}
for (const name of ['MessageThread', 'MessageComposer', 'MessageAttachment', 'QuestionComposer']) {
  await source(name, await readFile(path.join(root, 'src/components', `${name}.tsx`), 'utf8'))
}
await source('navigation', `const router = { push(url) { window.navigation = url }, replace(url) { window.navigation = url }, refresh() {} }; export function useRouter() { return router }`)
await source('link', `export default function Link(props) { return <a {...props} /> }`)
await source('icons', `export function MapPin() { return <span aria-hidden="true">📍</span> }`)
await source('actions', `
  export async function sendDirectMessage(input) { window.sent.push(input); return { success: true } }
  export async function searchQuestionItineraries() { return [{ id: 'paris', title: 'Paris with kids', user: { name: 'Jen' } }] }
  export async function createFriendQuestion(input) { window.posts.push(input); if (window.failPost) throw Error('offline'); return { id: 'question1' } }
  export async function replyToFriendQuestion(questionId, input) { window.posts.push({ questionId, ...input }); return { id: 'reply1' } }
`)
await source('entry', `
  import { createRoot } from 'react-dom/client'
  import MessageThread from './MessageThread'
  import QuestionComposer from './QuestionComposer'
  window.sent = []; window.posts = []
  const root = createRoot(document.getElementById('root'))
  const messages = [
    { id: 'paris-message', senderId: 'me', content: 'Where did you stay in Paris?', itineraryId: 'paris', itineraryTitle: 'Paris with kids', createdAt: new Date('2026-09-17T12:00:00Z') },
    { id: 'rome-message', senderId: 'jen', content: 'What was your favorite place in Rome?', itineraryId: 'rome', itineraryTitle: 'Rome weekend', createdAt: new Date('2026-09-17T13:00:00Z') },
    { id: 'quoted', senderId: 'jen', content: 'We stayed near the Louvre', itineraryId: 'paris', itineraryTitle: 'Paris with kids', replyTo: { id: 'paris-message', senderId: 'me', content: 'Where did you stay in Paris?', itineraryTitle: 'Paris with kids' }, createdAt: new Date('2026-09-17T14:00:00Z') },
  ]
  window.renderView = (view) => root.render(view === 'messages' ? <MessageThread messages={messages} userId="me" person={{id:'jen',name:'Jen'}} /> : <QuestionComposer key={view} questionId={view === 'reply' ? 'question1' : undefined} />)
  window.renderView('messages')
`)
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: 'development', devtool: false, entry: path.join(temp, 'entry.js'), output: { path: temp, filename: 'bundle.js' }, resolve: { modules: [path.join(root, 'node_modules'), 'node_modules'], alias: {
    'next/navigation': path.join(temp, 'navigation.js'), 'next/link': path.join(temp, 'link.js'), 'lucide-react': path.join(temp, 'icons.js'), '@/actions/messages': path.join(temp, 'actions.js'), '@/actions/questions': path.join(temp, 'actions.js'),
  } } })
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()))
})
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://discussions.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }))
  await page.goto('https://discussions.test/')
  await page.addScriptTag({ path: path.join(temp, 'bundle.js') })
  await page.getByRole('button', { name: 'Reply', exact: true }).first().waitFor()
  assert.match(await page.locator('blockquote').innerText(), /Where did you stay in Paris/)
  await page.getByRole('button', { name: 'Reply', exact: true }).nth(1).click()
  assert.match(await page.locator('form').innerText(), /Replying to Jen[\s\S]*Rome weekend/)
  await page.getByRole('textbox').fill('Try Trastevere!')
  await page.getByRole('button', { name: 'Reply', exact: true }).first().click()
  assert.equal(await page.getByRole('textbox').inputValue(), 'Try Trastevere!')
  assert.match(await page.locator('form').innerText(), /Paris with kids/)
  await page.getByRole('button', { name: 'Cancel reply' }).click()
  assert.doesNotMatch(await page.locator('form').innerText(), /Replying to/)
  await page.getByRole('button', { name: 'Reply', exact: true }).nth(1).click()
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await page.waitForFunction(() => window.sent.length === 1)
  const message = await page.evaluate(() => window.sent[0])
  assert.equal(message.replyToId, 'rome-message')
  assert.equal(message.content, 'Try Trastevere!')
  await page.waitForFunction(() => !document.querySelector('textarea').value)
  assert.doesNotMatch(await page.locator('form').innerText(), /Replying to/)

  await page.evaluate(() => window.renderView('question'))
  await page.getByRole('textbox', { name: 'What would you like to ask?' }).fill('Where should we stay?')
  await page.getByRole('button', { name: '+ Tag an itinerary' }).click()
  const search = page.getByRole('textbox', { name: 'Find an itinerary by title or paste its link' })
  await search.fill('Paris')
  await search.press('Enter')
  assert.equal(await page.evaluate(() => window.posts.length), 0)
  await page.getByRole('button', { name: 'Search itineraries', exact: true }).click()
  await page.getByRole('button', { name: /Paris with kids/ }).click()
  assert.equal(await page.getByRole('link', { name: 'View trip →' }).getAttribute('href'), '/itinerary/paris')
  await page.evaluate(() => { window.failPost = true })
  await page.getByRole('button', { name: 'Ask your friends', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByRole('textbox').inputValue(), 'Where should we stay?')
  await page.evaluate(() => { window.failPost = false })
  await page.getByRole('button', { name: 'Ask your friends', exact: true }).click()
  await page.waitForFunction(() => window.navigation === '/explore/questions/question1')
  const posts = await page.evaluate(() => window.posts)
  assert.equal(posts.length, 2)
  assert.equal(posts[0].clientId, posts[1].clientId)
  assert.equal(posts[1].itineraryId, 'paris')

  await page.evaluate(() => window.renderView('reply'))
  await page.getByRole('textbox', { name: 'Your reply' }).fill('Stay near the river.')
  await page.getByRole('button', { name: 'Post reply', exact: true }).click()
  await page.waitForFunction(() => window.posts.length === 3)
  assert.equal((await page.evaluate(() => window.posts[2])).questionId, 'question1')
  assert.deepEqual(errors, [])
  console.log('Browser checks passed: quoted replies, trip context, draft preservation, itinerary tagging, retry handling, and question replies.')
} finally { await browser.close() }
