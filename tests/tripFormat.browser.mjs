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
const temp = await mkdtemp(path.join(tmpdir(), 'xen-trip-format-'))
async function source(name, code) {
 await writeFile(path.join(temp, `${name}.js`), ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
}
for (const [name, file] of [['form','src/app/plan/NewPlanForm.tsx'],['picker','src/components/TripFormatPicker.tsx']]) await source(name, await readFile(path.join(root,file),'utf8'))
await source('stubs', `export const useRouter=()=>({push(){},refresh(){}}); export const copyPlaceToPlan=async()=>({});export const copyStoryToPlan=copyPlaceToPlan;export async function startPlan(data){window.saved=Object.fromEntries(data);return {id:'new'}};export default function Field({onChange,onSelect,maxLength,type,...props}){return <input {...props} onChange={e=>onChange(e.target.value)} />}`)
await source('entry', `import {createRoot} from 'react-dom/client';import Form from './form';createRoot(document.getElementById('root')).render(<Form/>);`)
await new Promise((resolve,reject)=>{
 const compiler=webpack({mode:'development',devtool:false,entry:path.join(temp,'entry.js'),output:{path:temp,filename:'bundle.js'},resolve:{modules:[path.join(root,'node_modules'),'node_modules'],alias:Object.fromEntries([['@/components/TripFormatPicker','picker'],...['next/link','next/navigation','@/actions/stories','@/actions/planning','@/components/PlacesAutocomplete'].map(x=>[x,'stubs'])].map(([a,b])=>[a,path.join(temp,b+'.js')]))}})
 compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()))
})
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}})
 await page.route('https://trip-format.test/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'}))
 await page.goto('https://trip-format.test/')
 await page.addScriptTag({path:path.join(temp,'bundle.js')})
 assert.equal(await page.getByRole('button',{name:'Guide',exact:true}).getAttribute('aria-pressed'),'true')
 await page.getByRole('button',{name:'Day trip',exact:true}).click()
 await page.getByLabel('Trip name').fill('Day out')
 await page.getByRole('button',{name:'Start planning',exact:true}).click()
 await page.waitForFunction(()=>window.saved)
 let saved=await page.evaluate(()=>window.saved)
 assert.equal(saved.format,'day-trip');assert.equal(saved.durationDays,'1');assert.equal(saved.startDate,'')
 await page.getByRole('button',{name:'Multi-day trip',exact:true}).click()
 await page.getByLabel('Number of days').fill('4')
 await page.getByRole('button',{name:'Start planning',exact:true}).click()
 await page.waitForFunction(()=>window.saved.durationDays==='4')
 await page.getByRole('button',{name:'Guide',exact:true}).click()
 await page.getByRole('button',{name:'Start planning',exact:true}).click()
 await page.waitForFunction(()=>window.saved.format==='guide')
 saved=await page.evaluate(()=>window.saved);assert.equal(saved.durationDays,undefined)
 console.log('PASS: guide, day trip, and multi-day selection submit the correct duration on mobile.')
} finally {await browser.close()}
