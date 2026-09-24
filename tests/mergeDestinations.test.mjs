import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as placeIdentity from '../src/lib/planPlaceIdentity.ts'

const code = ts.transpileModule(readFileSync(new URL('../src/app/api/admin/merge-destinations/route.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

function harness() {
  // The Capri trip from the bug report: the snapshot put Taverna in a second "Capri" destination.
  const destinations = [
    { id: 'capri', itineraryId: 'trip', name: 'Capri', country: 'Italy', order: 0 },
    { id: 'capri-2', itineraryId: 'trip', name: 'Capri', country: 'Metropolitan City of Naples, Italy', order: 1 },
    { id: 'rome', itineraryId: 'other', name: 'Rome', country: 'Italy', order: 0 },
  ]
  const items = [
    { id: 'fontelina', destinationId: 'capri', name: 'La Fontelina', type: 'activity', order: 0, groupIndex: 0 },
    { id: 'taverna', destinationId: 'capri-2', name: 'Taverna Anema e Core', type: 'activity', order: 0, groupIndex: 0 },
  ]
  const writes = []
  const trips = [{ id: 'trip', title: 'Amalfi', userId: 'owner', user: { name: 'Owner' } }, { id: 'other', title: 'Rome', userId: 'owner', user: { name: 'Owner' } }]
  const prisma = {
    itinerary: { findMany: async ({ where }) => trips.filter(trip => !where.id || trip.id === where.id).map(trip => ({ ...trip,
      destinations: destinations.filter(d => d.itineraryId === trip.id).sort((a, b) => a.order - b.order).map(d => ({ ...d, items: items.filter(item => item.destinationId === d.id) })) })) },
    destItem: { update: async ({ where, data }) => { writes.push(['item', where.id, data]); Object.assign(items.find(item => item.id === where.id), data) } },
    destination: { delete: async ({ where }) => { writes.push(['delete', where.id]); destinations.splice(destinations.findIndex(d => d.id === where.id), 1) } },
  }
  prisma.$transaction = async callback => callback(prisma)
  const exports = {}
  vm.runInNewContext(code, { exports, process: { env: { ADMIN_SECRET: 's3cret' } }, Response, require: name => ({ '@/lib/prisma': { prisma }, 'next/cache': { revalidatePath() {} }, '@/lib/planPlaceIdentity': placeIdentity, 'next/server': {} })[name] })
  const get = query => exports.GET({ nextUrl: { searchParams: new URLSearchParams(query) } })
  return { get, destinations, items, writes }
}

test('merge-destinations needs the admin secret', async () => {
  assert.equal((await harness().get('secret=wrong')).status, 401)
})
test('dry run lists the duplicate Capri without changing anything', async () => {
  const h = harness()
  const body = await (await h.get('secret=s3cret')).json()
  assert.equal(body.dryRun, true); assert.equal(body.trips, 1); assert.equal(body.summary[0].trip, 'trip')
  assert.equal(h.writes.length, 0)
})
test('merging requires naming one trip', async () => {
  assert.equal((await harness().get('secret=s3cret&apply=1')).status, 400)
})
test('applying moves Taverna into the original Capri and removes the empty duplicate', async () => {
  const h = harness()
  const body = await (await h.get('secret=s3cret&trip=trip&apply=1')).json()
  assert.equal(body.merged, 1)
  assert.equal(h.items.find(item => item.id === 'taverna').destinationId, 'capri')
  assert.equal(h.items.find(item => item.id === 'taverna').order, 1)
  assert.deepEqual(h.destinations.map(d => d.id), ['capri', 'rome'])
})
