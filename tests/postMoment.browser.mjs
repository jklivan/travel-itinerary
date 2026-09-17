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
const temp = await mkdtemp(path.join(tmpdir(), 'xen-post-moment-'))
async function source(name, code) {
 await writeFile(path.join(temp, `${name}.js`), ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
}
for (const name of ['PlaceQuickEdit','StoryComposer']) await source(name, await readFile(path.join(root,`src/components/${name}.tsx`),'utf8'))
await source('stubs', `export const useRouter=()=>({refresh(){}});export const Camera=()=>null;export const Star=Camera;export const Plus=Camera;export const X=Camera;export const Check=Camera;export async function updatePlace(){return {success:true}};export async function storySources(){return {isPrivate:false,trips:[{id:'unrelated',title:'Other trip',photos:[],places:[]},{id:'ct',title:'Connecticut',photos:[],places:[{id:'casa',name:'Casa Me',type:'food_drink',destination:'Westport, CT',photos:window.withPhoto?['/casa.jpg']:[]}]}]}};export async function postStory(input){window.posted=input;return window.failPost?{error:'Try again'}:{success:true}};export default function Field({onChange}){return <button type="button" onClick={()=>onChange(['/uploaded.jpg'])}>Upload photo</button>}`)
await source('styles', `export default {}`)
await source('entry', `import {createRoot} from 'react-dom/client';import QuickEdit from './PlaceQuickEdit';createRoot(document.getElementById('root')).render(<QuickEdit itemId="casa" name="Casa Me" rating={5} photos={[]}/>);`)
await new Promise((resolve,reject)=>{
 const compiler=webpack({mode:'development',devtool:false,entry:path.join(temp,'entry.js'),output:{path:temp,filename:'bundle.js'},resolve:{modules:[path.join(root,'node_modules'),'node_modules'],alias:Object.fromEntries([['./Stories.module.css','styles'],...['./EventPhotoInput','next/link','next/navigation','lucide-react','@/actions/stories','@/actions/placeQuickEdit'].map(x=>[x,'stubs'])].map(([a,b])=>[a,path.join(temp,b+'.js')]))}})
 compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()))
})
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}})
 await page.route('https://moment.test/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'}))
 for(const withPhoto of [true,false]) {
  await page.goto('https://moment.test/')
  await page.evaluate(value=>{window.withPhoto=value;window.failPost=true},withPhoto)
  await page.addScriptTag({path:path.join(temp,'bundle.js')})
  await page.getByRole('button',{name:'Post this moment at Casa Me'}).click()
  await page.getByLabel('Your trip').waitFor()
  assert.equal(await page.getByLabel('Your trip').inputValue(),'ct')
  assert.equal(await page.getByLabel('Choose a place or transport').inputValue(),'casa')
  const post=page.getByRole('button',{name:'Post for 24 hours',exact:true})
  if(!withPhoto){assert.equal(await post.isDisabled(),true);await page.getByRole('button',{name:'Upload photo'}).click()}
  await page.getByLabel('Caption').fill('Lovely lunch')
  await post.click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByLabel('Caption').inputValue(),'Lovely lunch')
  await page.evaluate(()=>{window.failPost=false})
  await post.click()
  await page.getByRole('status').waitFor()
  const posted=await page.evaluate(()=>window.posted)
  assert.equal(posted.itemId,'casa');assert.equal(posted.caption,'Lovely lunch');assert.equal(posted.photoUrl,withPhoto?'/casa.jpg':'/uploaded.jpg')
  assert.match(await page.getByRole('status').textContent(),/Little moments/)
  assert.equal(await page.getByRole('dialog').count(),0)
 }
 console.log('PASS: place preselection, existing photo, new upload, failed-post retry, and success confirmation.')
} finally {await browser.close()}
