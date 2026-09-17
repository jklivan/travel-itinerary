import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { createPublishedTripNotifications } from '../src/lib/notifications.ts'
import * as threadUrls from '../src/lib/messageThread.ts'
const textExports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/notificationText.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: textExports, require: () => threadUrls })
const { notificationText, notificationPath } = textExports

test('published alerts only reach accepted followers and deduplicate per trip and recipient', async () => {
  const rows = new Map()
  const follows = [{followerId:'friend',status:'accepted'}, {followerId:'pending',status:'pending'}, {followerId:'author',status:'accepted'}]
  const tx = {
    itinerary: { findUnique: async () => ({userId:'author',visibility:'public'}) },
    follow: { findMany: async ({where}) => {
      assert.equal(where.followingId,'author')
      return follows.filter(f => f.status===where.status && f.followerId!==where.followerId.not)
    } },
    notification: { createManyAndReturn: async ({data,skipDuplicates}) => {
      assert.equal(skipDuplicates,true)
      return data.flatMap(row=> { if(rows.has(row.dedupeKey))return [];rows.set(row.dedupeKey,row);return [{id:row.dedupeKey}] })
    } },
  }
  assert.equal((await createPublishedTripNotifications(tx,'trip')).length,1)
  assert.equal((await createPublishedTripNotifications(tx,'trip')).length,0)
  assert.equal([...rows.values()][0].recipientId,'friend')
  assert.equal([...rows.values()][0].kind,'published')
  for(const itinerary of [null,{userId:'author',visibility:'draft'}]) {
    tx.itinerary.findUnique=async()=>itinerary
    tx.follow.findMany=async()=>{throw Error('Must not query followers')}
    assert.equal((await createPublishedTripNotifications(tx,'trip')).length,0)
  }
  assert.equal(notificationText('published','Jen','Paris'),'Jen posted a new trip: “Paris”.')
  assert.equal(notificationPath('trip','published'),'/itinerary/trip')
})

const source = ts.createSourceFile('actions.ts',readFileSync(new URL('../src/actions/itinerary.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
async function save(name, {draft=false,previous='draft',fail=false}={}) {
  const fn=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name)
  const scheduled=[]
  const input={title:'Trip',description:'',postType:'itinerary',isDraft:draft,visibility:draft?'draft':'public',startDate:'2026-09-01',endDate:'2026-09-02',startDateStr:'2026-09-01',endDateStr:'2026-09-02',destinations:[{name:'Paris',groups:[]}],photos:[{url:'photo'}],tags:['city']}
  const itinerary={create:async()=>{if(fail)throw Error('save failed');return {id:'trip'}},findUnique:async()=>({userId:'author',visibility:previous}),update:async()=>{if(fail)throw Error('save failed')}}
  const tx={itinerary,destination:{deleteMany:async()=>{}},photo:{deleteMany:async()=>{}}}
  const noop=async()=>{}
  const ctx={input,form:new FormData(),auth:async()=>({user:{id:'author'}}),prisma:{...tx,$transaction:async fn=>fn(tx)},parseFormData:()=>input,flattenGroups:()=>[{name:'place'}],scheduleTripPublishedNotifications:id=>scheduled.push(id),withTimeout:promise=>promise,geocodeItineraryDests:noop,geocodeItineraryItems:noop,inferMissingAttributes:noop,generateMissingDescriptions:noop,revalidatePath(){},redirect(){}}
  const call=name==='createItineraryDirect'?`${name}(input)`:name==='updateItinerary'?`${name}('trip',undefined,form)`:`${name}(undefined,form)`
  const code=ts.transpileModule(fn.getText(source).replace('export ','')+'\n'+call,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  try {await vm.runInNewContext(code,ctx)}catch(error){if(!fail)throw error}
  return scheduled
}
for(const name of ['createItinerary','createItineraryDirect']) {
  test(`${name} alerts after publishing, never drafts or failed saves`,async()=>{
    assert.deepEqual(await save(name),['trip'])
    assert.deepEqual(await save(name,{draft:true}),[])
    assert.deepEqual(await save(name,{fail:true}),[])
  })
}
test('editing only alerts on a successful draft-to-public transition',async()=>{
  assert.deepEqual(await save('updateItinerary'),['trip'])
  assert.deepEqual(await save('updateItinerary',{previous:'public'}),[])
  assert.deepEqual(await save('updateItinerary',{draft:true}),[])
  assert.deepEqual(await save('updateItinerary',{fail:true}),[])
})
