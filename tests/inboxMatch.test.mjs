import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeDates from '../src/lib/placeDates.ts'
import * as distance from '../src/lib/distance.ts'

// Which plan an emailed booking joins: loaded with the database and map lookups stubbed.
const ASPEN = { lat: 39.19, lng: -106.82 }, SNOWMASS = { lat: 39.21, lng: -106.95 }, LONDON = { lat: 51.5, lng: -0.12 }
function load(plans, points = {}) {
  const located = []
  const prisma = { itinerary: { findMany: async () => plans.map(plan => ({ ...plan, destinations: plan.destinations.map(stop => ({ items: [], lat: null, lng: null, country: null, ...stop })) })) } }
  const deps = {
    '@/lib/prisma': { prisma }, '@/lib/placeDates': placeDates, '@/lib/distance': distance,
    '@/lib/planPlaceIdentity': { samePlanDestination: (a, b) => a.name.split(',')[0].trim().toLowerCase() === b.name.split(',')[0].trim().toLowerCase() },
    '@/lib/tripAccess': { canEdit: id => ({ userId: id }) },
    '@/lib/geocode': { geocodePlaceByName: async query => points[query] ?? null, geocode: async query => points[query] ?? null },
    '@/lib/locateDestinations': { locateDestinations: async id => { located.push(id); for (const plan of plans) if (plan.id === id) for (const stop of plan.destinations) if (stop.at) Object.assign(stop, stop.at) } },
  }
  const exports = {}
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/inboxImport.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: name => deps[name] ?? {}, console })
  return { matchingPlan: exports.matchingPlan, located }
}
const plan = (id, destinations, dates) => ({ id, title: id, datesFlexible: !dates, startDate: new Date(`${dates?.[0] ?? '2026-01-01'}T00:00:00Z`), endDate: new Date(`${dates?.[1] ?? '2026-01-01'}T00:00:00Z`), destinations })
const dinner = [{ name: 'Ajax Tavern', destination: 'Aspen', country: 'United States', type: 'food_drink' }]
const dec29 = { start: '2026-12-29', end: '2026-12-29' }
const aspenPoints = { 'Ajax Tavern, Aspen, United States': ASPEN }

test('a dinner in Aspen joins the Snowmass plan on those dates (a different town 10 miles away)', async () => {
  const { matchingPlan } = load([plan('london', [{ name: 'London', ...LONDON }], ['2026-12-28', '2027-01-02']), plan('snowmass', [{ name: 'Snowmass', ...SNOWMASS }], ['2026-12-27', '2026-12-31'])], aspenPoints)
  assert.equal((await matchingPlan('me', dec29, dinner)).id, 'snowmass')
})
test('a plan with no fixed dates in the same area is used; one somewhere else on those dates is not', async () => {
  const { matchingPlan } = load([plan('london', [{ name: 'London', ...LONDON }], ['2026-12-28', '2027-01-02']), plan('snowmass', [{ name: 'Snowmass', ...SNOWMASS }])], aspenPoints)
  assert.equal((await matchingPlan('me', dec29, dinner)).id, 'snowmass')
  const elsewhere = load([plan('london', [{ name: 'London', ...LONDON }], ['2026-12-28', '2027-01-02'])], aspenPoints)
  assert.equal(await elsewhere.matchingPlan('me', dec29, dinner), null)
})
test('last year\'s Snowmass plan with other dates is not used', async () => {
  const { matchingPlan } = load([plan('snowmass-2025', [{ name: 'Snowmass', ...SNOWMASS }], ['2025-12-27', '2025-12-31'])], aspenPoints)
  assert.equal(await matchingPlan('me', dec29, dinner), null)
})
test('towns not yet on the map are located first; plans with only dates and no destination still match', async () => {
  const { matchingPlan, located } = load([plan('snowmass', [{ name: 'Snowmass', at: SNOWMASS }])], aspenPoints)
  assert.equal((await matchingPlan('me', dec29, dinner)).id, 'snowmass')
  assert.deepEqual(located, ['snowmass'])
  const blank = load([plan('blank', [{ name: 'Destination to decide' }], ['2026-12-28', '2026-12-30'])], aspenPoints)
  assert.equal((await blank.matchingPlan('me', dec29, dinner)).id, 'blank')
})
test('with no map position, the same town name still matches', async () => {
  const { matchingPlan } = load([plan('aspen', [{ name: 'Aspen, CO' }])])
  assert.equal((await matchingPlan('me', dec29, dinner)).id, 'aspen')
})
