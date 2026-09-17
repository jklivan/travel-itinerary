// Actual React UI with stubbed server actions. Run: node tests/quickSavePlan.browser.mjs
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
const temp = await mkdtemp(path.join(tmpdir(), 'xen-quick-save-'))
async function source(name, text) {
  await writeFile(path.join(temp, `${name}.js`), ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
}
const component = await readFile(path.join(root, 'src/components/SavePlaceToPlan.tsx'), 'utf8')
const moduleCss = await readFile(path.join(root, 'src/components/SavePlaceToPlan.module.css'), 'utf8')
await source('SavePlaceToPlan', component)
await source('styles', `export default ${JSON.stringify(Object.fromEntries([...moduleCss.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => [m[1],m[1]])))}`)
await source('icons', `export const Check = () => <span />; export const ChevronRight = Check; export const MapPin = Check; export const Plus = Check; export const X = Check;`)
await source('link', `export default function Link({href,onClick,...props}) { return <a {...props} href={href} onClick={e => { e.preventDefault(); onClick?.(e); window.navigation=href }} /> }`)
await source('actions', `
  export async function plansForSaving() { return { trips: window.trips } }
  export async function copyPlaceToPlan(itemId, planId, clientId) { window.existingSaves.push({itemId,planId,clientId}); return {success:true} }
  export async function copyStoryToPlan(storyId, planId, clientId) { window.existingSaves.push({storyId,planId,clientId}); return {success:true} }
  export async function savePlaceToNewPlan(input) {
    window.attempts.push(input)
    if(window.failSave) throw Error('offline')
    const trip={id:'new-trip',title:'Trip to London'}
    window.trips=[trip]
    return {trip}
  }
`)
await source('entry', `
  import {createRoot} from 'react-dom/client'
  import {useState} from 'react'
  import SavePlaceToPlan from './SavePlaceToPlan'
  window.trips=[]; window.attempts=[]; window.existingSaves=[]; window.savedCount=0
  function App() {
    const [item,setItem]=useState('museum'); const [open,setOpen]=useState(false)
    return <><div style={{height:700}}>Jen's itinerary</div><button onClick={()=>{setItem('museum');setOpen(true)}}>Save Museum</button><button onClick={()=>{setItem('cafe');setOpen(true)}}>Save Cafe</button><div style={{height:700}} /><SavePlaceToPlan key={item} itemId={item} placeName={item==='museum'?'Science Museum':'London Cafe'} open={open} onClose={()=>setOpen(false)} onSaved={()=>window.savedCount++} /></>
  }
  createRoot(document.getElementById('root')).render(<App />)
`)
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: 'development', devtool: false, entry: path.join(temp, 'entry.js'), output: { path: temp, filename: 'bundle.js' }, resolve: { modules: [path.join(root, 'node_modules'), 'node_modules'], alias: {
    'next/link': path.join(temp, 'link.js'), 'lucide-react': path.join(temp, 'icons.js'), './SavePlaceToPlan.module.css': path.join(temp,'styles.js'), '@/actions/planning': path.join(temp,'actions.js'), '@/actions/stories': path.join(temp,'actions.js'), '@/actions/quickSavePlan': path.join(temp,'actions.js'),
  } } })
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()))
})
const css = (await compile('@import "tailwindcss";', { base: root, onDependency() {} })).build(component.split(/[\s"'`{}<>]+/))
const browser = await chromium.launch({headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}})
 page.setDefaultTimeout(10000)
 const errors=[]; page.on('pageerror',e=>errors.push(e.message))
 await page.route('https://quick-save.test/**',route=>route.fulfill({contentType:'text/html',body:'<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#F3EAD9"><div id="root"></div></body></html>'}))
 await page.goto('https://quick-save.test/itinerary/jen')
 await page.addStyleTag({content:css+moduleCss})
 await page.addScriptTag({path:path.join(temp,'bundle.js')})
 await page.getByRole('button',{name:'Save Museum',exact:true}).click()
 const scroll=await page.evaluate(()=>scrollY)
 await page.getByRole('dialog',{name:'Which trip?',exact:true}).waitFor()
 assert.equal(await page.getByRole('textbox').count(),0)
 await page.getByRole('button',{name:/^New trip/}).waitFor()
 await page.evaluate(()=>{window.failSave=true})
 await page.getByRole('button',{name:/^New trip/}).click()
 await page.getByRole('alert').waitFor()
 assert.equal(await page.evaluate(()=>window.trips.length),0)
 await page.evaluate(()=>{window.failSave=false})
 await page.getByRole('button',{name:/^New trip/}).click()
 await page.getByRole('status').filter({hasText:'Added to Trip to London'}).waitFor()
 assert.equal(await page.getByRole('link',{name:'Finish new trip'}).getAttribute('href'),'/plan/new-trip?details=1')
 const attempts=await page.evaluate(()=>window.attempts)
 assert.equal(attempts[0].clientId,attempts[1].clientId)
 assert.equal(attempts[1].itemId,'museum')
 await page.screenshot({path:path.join(temp,'quick-save-mobile.png')})
 await page.getByRole('button',{name:'Keep browsing',exact:true}).click()
 assert.equal(await page.getByRole('dialog').count(),0)
 assert.equal(page.url(),'https://quick-save.test/itinerary/jen')
 assert.ok(Math.abs((await page.evaluate(()=>scrollY))-scroll)<5)
 await page.getByRole('button',{name:'Save Cafe',exact:true}).click()
 const existing=page.getByRole('button',{name:/Trip to London.*Add this place/})
 await existing.click()
 await page.getByRole('status').filter({hasText:'Added to Trip to London'}).waitFor()
 assert.equal((await page.evaluate(()=>window.existingSaves[0])).itemId,'cafe')
 assert.equal((await page.evaluate(()=>window.existingSaves[0])).planId,'new-trip')
 await page.getByRole('button',{name:'Keep browsing',exact:true}).click()
 await page.getByRole('button',{name:'Save Museum',exact:true}).click()
 await page.getByRole('button',{name:/^New trip/}).click()
 await page.getByRole('link',{name:'Finish new trip'}).click()
 assert.equal(await page.evaluate(()=>window.navigation),'/plan/new-trip?details=1')
 assert.deepEqual(errors,[])
 console.log('Browser passed: immediate new-trip save, retry, original itinerary/scroll preserved, next-place existing-trip picker, and finish-trip navigation.')
 console.log('Screenshot:',path.join(temp,'quick-save-mobile.png'))
} finally { await browser.close() }
