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
const temp = await mkdtemp(path.join(tmpdir(), 'xen-toolbar-'))
async function source(name, code) {
 await writeFile(path.join(temp, `${name}.js`), ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
}
const nav = await readFile(path.join(root,'src/components/BottomNav.tsx'),'utf8')
for (const [name,file] of [['BottomNav','src/components/BottomNav.tsx'],['useBottomToolbar','src/components/useBottomToolbar.ts'],['toolbarMath','src/lib/bottomToolbar.ts']]) await source(name, await readFile(path.join(root,file),'utf8'))
await source('stubs', `export const Capacitor={getPlatform:()=> 'ios'};export const usePathname=()=>'/';export const Home=()=>null;export const Compass=Home;export const Plus=Home;export const User=Home;export const MessageCircle=Home;export default function Link({href,...props}){return <a href={href} {...props}/>}`)
await source('counts', `export default ()=>({unreadMessages:0})`)
await source('entry', `import {createRoot} from 'react-dom/client';import Nav from './BottomNav';window.mockViewport=new EventTarget();Object.assign(window.mockViewport,{height:innerHeight,scale:1});Object.defineProperty(window,'visualViewport',{value:window.mockViewport});createRoot(document.getElementById('root')).render(<><input aria-label="Message"/><div style={{height:4000}}>Scroll content</div><Nav pendingCount={0} userId="me"/></>);`)
await new Promise((resolve,reject)=>{
 const compiler=webpack({mode:'development',devtool:false,entry:path.join(temp,'entry.js'),output:{path:temp,filename:'bundle.js'},resolve:{modules:[path.join(root,'node_modules'),'node_modules'],alias:Object.fromEntries([['@/lib/bottomToolbar','toolbarMath'],['./useNotificationCounts','counts'],...['@capacitor/core','next/link','next/navigation','lucide-react'].map(x=>[x,'stubs'])].map(([a,b])=>[a,path.join(temp,b+'.js')]))}})
 compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()))
})
const css=(await compile('@import "tailwindcss";', {base:root,onDependency(){}})).build(nav.split(/[\s"'`{}<>]+/))
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}})
 await page.route('https://toolbar.test/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'}))
 await page.goto('https://toolbar.test/')
 await page.addStyleTag({content:css})
 await page.addScriptTag({path:path.join(temp,'bundle.js')})
 await page.getByLabel('Main navigation').waitFor()
 // Read geometry in the same task as scrolling, before any scroll/rAF handler
 // can catch up. Absolute positioning fails this regression check.
 for(const y of [0,100,900,2500,9999,400,0]) {
  const geometry=await page.evaluate(y=>{scrollTo(0,y);const bar=document.querySelector('[aria-label="Main navigation"]');return {position:getComputedStyle(bar).position,bottom:bar.getBoundingClientRect().bottom,height:innerHeight}},y)
  assert.equal(geometry.position,'fixed');assert.equal(geometry.bottom,geometry.height)
 }
 await page.setViewportSize({width:844,height:390})
 assert.equal(await page.getByLabel('Main navigation').evaluate(el=>el.getBoundingClientRect().bottom),390)
 await page.getByLabel('Message',{exact:true}).focus()
 await page.evaluate(()=>{window.mockViewport.height=180;window.mockViewport.dispatchEvent(new Event('resize'))})
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('[aria-label="Main navigation"]')).visibility==='hidden')
 await page.getByLabel('Message',{exact:true}).blur()
 await page.evaluate(()=>{window.mockViewport.height=innerHeight;window.mockViewport.dispatchEvent(new Event('resize'))})
 await page.getByLabel('Main navigation').waitFor({state:'visible'})
 console.log('PASS: iOS-path toolbar stays fixed through scrolling and rotation, hides for keyboard, and returns after dismissal.')
} finally {await browser.close()}
