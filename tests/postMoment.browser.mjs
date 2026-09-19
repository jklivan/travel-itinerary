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
const storyCss = await readFile(path.join(root,'src/components/Stories.module.css'),'utf8')
const styleClasses = [...new Set([...storyCss.matchAll(/\.([A-Za-z][\w-]*)/g)].map(match=>match[1]))]
await source('stubs', `export const useRouter=()=>({refresh(){}});export const Camera=()=>null;export const Star=Camera;export const Plus=Camera;export const X=Camera;export const Check=Camera;export async function updatePlace(){return {success:true}};export async function storySources(){return {isPrivate:false,trips:[{id:'ct',title:'Newest trip',isPlan:true,photos:[],places:[{id:'casa',name:'Casa Me',type:'food_drink',destination:'Westport, CT',photos:window.withPhoto?['/casa.jpg']:[]}]},{id:'unrelated',title:'Older trip',isPlan:false,photos:[],places:[]}]}};export async function postStories(input){window.posted=input;return window.failPost?{error:'Try again'}:{success:true}};export default function Field(props){if(Object.hasOwn(props,'value')){const {value,onChange,...inputProps}=props;return <input {...inputProps} value={value} onChange={event=>onChange(event.target.value)}/>};return <button type="button" onClick={()=>props.onChange(['/uploaded.jpg'])}>Upload photo</button>}`)
await source('styles', `export default ${JSON.stringify(Object.fromEntries(styleClasses.map(name=>[name,name])))}`)
await source('entry', `import {createRoot} from 'react-dom/client';import QuickEdit from './PlaceQuickEdit';createRoot(document.getElementById('root')).render(<QuickEdit itemId="casa" name="Casa Me" rating={5} photos={[]}/>);`)
await source('standalone-entry', `import {createRoot} from 'react-dom/client';import StoryComposer from './StoryComposer';createRoot(document.getElementById('root')).render(<StoryComposer onClose={()=>{}} onPosted={()=>{document.body.dataset.posted='true';document.body.insertAdjacentHTML('beforeend','<div role="status">Posted to Little moments for 24 hours.</div>')}}/>);`)
await new Promise((resolve,reject)=>{
 const compiler=webpack({mode:'development',devtool:false,entry:{bundle:path.join(temp,'entry.js'),standalone:path.join(temp,'standalone-entry.js')},output:{path:temp,filename:'[name].js'},resolve:{modules:[path.join(root,'node_modules'),'node_modules'],alias:Object.fromEntries([['./Stories.module.css','styles'],...['./EventPhotoInput','./PlacesAutocomplete','next/link','next/navigation','lucide-react','@/actions/stories','@/actions/placeQuickEdit'].map(x=>[x,'stubs'])].map(([a,b])=>[a,path.join(temp,b+'.js')]))}})
 compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()))
})
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}})
 await page.route('https://moment.test/**',route=>route.fulfill({contentType:'text/html',body:`<html><head><style>${storyCss}</style></head><body><div id="root"></div></body></html>`}))
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
  assert.equal(posted.itemId,'casa');assert.equal(posted.caption,'Lovely lunch');assert.deepEqual(Array.from(posted.photos,photo=>photo.photoUrl),[withPhoto?'/casa.jpg':'/uploaded.jpg'])
  assert.match(await page.getByRole('status').textContent(),/Little moments/)
  assert.equal(await page.getByRole('dialog').count(),0)
  assert.equal(page.url(),'https://moment.test/','posting a story stays on the current screen')
 }
 await page.goto('https://moment.test/')
 await page.evaluate(()=>{window.withPhoto=false;window.failPost=false})
 await page.addScriptTag({path:path.join(temp,'standalone.js')})
 const fromTrip=page.getByRole('dialog')
 await fromTrip.getByRole('tab',{name:'From a trip'}).click()
 assert.equal(await fromTrip.getByLabel('Your trip').inputValue(),'ct','the most recently created trip is selected by default')
 await fromTrip.getByLabel('Choose a place or transport').selectOption('casa')
 await fromTrip.getByRole('button',{name:'Upload photo'}).click()
 const scrollPane=fromTrip.locator('form')
 assert.equal(await scrollPane.evaluate(element=>element.scrollHeight>element.clientHeight),true,'the story form scrolls inside the mobile composer')
 await fromTrip.getByRole('button',{name:'Post for 24 hours',exact:true}).scrollIntoViewIfNeeded()
 assert.equal(await fromTrip.getByRole('button',{name:'Post for 24 hours',exact:true}).isVisible(),true)
 assert.ok(await scrollPane.evaluate(element=>element.scrollTop>0),'scrolling reveals post controls without dismissing the composer')
 await page.getByRole('dialog').evaluate(dialog=>dialog.close())
 await page.goto('https://moment.test/')
 await page.evaluate(()=>{window.withPhoto=false;window.failPost=false})
 await page.addScriptTag({path:path.join(temp,'standalone.js')})
 await page.getByRole('tab',{name:'New activity'}).waitFor()
 const composer=page.getByRole('dialog')
 const standalonePost=composer.getByRole('button',{name:'Post for 24 hours',exact:true})
 await composer.getByRole('button',{name:'Upload photo'}).click()
 assert.equal(await standalonePost.isEnabled(),true,'a photo is enough to enable Post; missing required fields remain discoverable')
 await page.getByLabel('Itinerary title').fill('Lucerne weekend')
 await page.getByPlaceholder('City or area').fill('Lucerne, Switzerland')
 await page.getByPlaceholder('Search or enter a name').fill('Lakeside walk')
 await composer.locator('textarea').fill('No itinerary needed')
 await standalonePost.click()
 await page.getByRole('status').waitFor()
 const standalone=await page.evaluate(()=>window.posted)
 assert.equal(standalone.itemId,undefined);assert.equal(standalone.placeName,'Lakeside walk');assert.equal(standalone.destination,'Lucerne, Switzerland');assert.equal(standalone.type,'activity');assert.equal(standalone.newPlanTitle,'Lucerne weekend');assert.match(standalone.newPlanId,/^[a-f0-9-]{36}$/);assert.deepEqual(Array.from(standalone.photos,photo=>photo.photoUrl),['/uploaded.jpg'])
 console.log('PASS: existing-trip moments, new itinerary moments, uploads, retries, and mobile story scrolling.')
} finally {await browser.close()}
