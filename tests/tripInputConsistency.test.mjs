import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { tripDetailsError } from '../src/lib/tripDates.ts'
import { moveItemToDay, reorderItems } from '../src/lib/reorderItems.ts'
function runFunction(path, name, call, context) {
 const src = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
 function find(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === name) return n; return ts.forEachChild(n, find) }
 return vm.runInNewContext(ts.transpileModule(find(src).getText(src) + '\n' + call, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
}
test('required details validate before continuing, with no dates required for guides', () => {
 assert.match(tripDetailsError('', 'itinerary', '', ''), /title/)
 assert.match(tripDetailsError('Trip', 'itinerary', '2026-13', '3'), /month/)
 assert.match(tripDetailsError('Trip', 'itinerary', '2026-09', '1.5'), /days/)
 assert.equal(tripDetailsError('Trip', 'itinerary', '2026-09', '3'), null)
 assert.equal(tripDetailsError('Guide', 'guide', '', ''), null)
})
test('standard basics blocks incomplete details and returns corrected details to final review', () => {
 const context = { step: 'basics', title: '', postType: 'itinerary', tripMonth: '2026-09', tripDays: '3', tripDetailsError, returnToReview: true, setFormError(error) { context.error = error }, setReturnToReview(value) { context.returnToReview = value }, setStep(step) { context.step = step } }
 runFunction('../src/app/create/page.tsx', 'goNext', 'goNext()', context)
 assert.equal(context.step, 'basics'); assert.match(context.error, /title/)
 context.title = 'Trip'
 runFunction('../src/app/create/page.tsx', 'goNext', 'goNext()', context)
 assert.equal(context.step, 'details')
})
test('guided drag moves only the chosen event to another day, including an empty day target', () => {
 let items = [{ id: 'a', dayIndex: 1 }, { id: 'b', dayIndex: 1 }, { id: 'c', dayIndex: 2 }]
 const context = { postType: 'itinerary', moveItemToDay, reorderItems, setDraggedItem() {}, setCurItems(update) { items = update(items) }, event: { active: { id: 'a' }, over: { id: 'c', data: { current: {} } } } }
 runFunction('../src/app/create/guided/page.tsx', 'handleDragEnd', 'handleDragEnd(event)', context)
 assert.equal(items.find(i=>i.id==='a').dayIndex, 2)
 assert.equal(items.find(i=>i.id==='b').dayIndex, 1)
 assert.deepEqual(items.filter(i=>i.dayIndex===2).map(i=>i.id), ['c','a'])
 context.event.over = { id: 'day-end-3', data: { current: { day: 3 } } }
 runFunction('../src/app/create/guided/page.tsx', 'handleDragEnd', 'handleDragEnd(event)', context)
 assert.equal(items.find(i=>i.id==='a').dayIndex, 3)
 assert.equal(items.find(i=>i.id==='c').dayIndex, 2)
})
test('standard day transfer preserves other events and moves to the target stay/day', () => {
 let destinations = [{ groups: [{ days: [{ food: [{name:'Cafe',notes:'Keep',order:0}],activities:[] }] }, { days: [{food:[],activities:[{name:'Museum',order:9}]}] }] }]
 const context = { setDestinations(update) { destinations = update(destinations) } }
 runFunction('../src/app/create/page.tsx', 'movePlace', 'movePlace(0,0,0,0,"food","1:0")', context)
 assert.equal(destinations[0].groups[0].days[0].food.length,0)
 const target=destinations[0].groups[1].days[0]
 assert.equal(target.food[0].notes,'Keep');assert.equal(target.food[0].order,10);assert.equal(target.activities[0].name,'Museum')
})
