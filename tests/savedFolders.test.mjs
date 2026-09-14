import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function harness(userId = 'alice') {
  const folders = new Map([['beach', { id: 'beach', userId: 'alice', name: 'Beach ideas' }], ['private', { id: 'private', userId: 'bob', name: 'Private' }]])
  const saves = new Map()
  const notifications = []
  const invalidated = []
  const itinerary = { userId: 'author', visibility: 'public' }
  const owned = where => [...folders.values()].filter(f => Object.entries(where).every(([key, value]) => f[key] === value))
  const prisma = {
    itinerary: { findUnique: async () => itinerary },
    savedFolder: {
      findFirst: async ({ where }) => owned(where)[0] ?? null,
      findMany: async ({ where }) => owned(where).map(({ id, name }) => ({ id, name })),
      create: async ({ data }) => {
        if (owned(data).length) throw { code: 'P2002' }
        const folder = { id: `folder-${folders.size}`, ...data }
        folders.set(folder.id, folder)
        return folder
      },
      update: async ({ where, data }) => {
        const folder = owned(where)[0]
        if (!folder) throw { code: 'P2025' }
        Object.assign(folder, data)
        return folder
      },
      deleteMany: async ({ where }) => {
        for (const folder of owned(where)) folders.delete(folder.id)
      },
    },
    bucketListItem: {
      findUnique: async ({ where }) => saves.get(`${where.userId_itineraryId.userId}:${where.userId_itineraryId.itineraryId}`) ?? null,
      createMany: async ({ data: [data] }) => {
        const key = `${data.userId}:${data.itineraryId}`
        if (saves.has(key)) return { count: 0 }
        saves.set(key, { ...data, folderId: data.folderId ?? null })
        return { count: 1 }
      },
      update: async ({ where, data }) => Object.assign(saves.get(`${where.userId_itineraryId.userId}:${where.userId_itineraryId.itineraryId}`), data),
    },
    $transaction: async fn => fn(prisma),
  }
  const dependencies = {
    '@/auth': { auth: async () => userId ? { user: { id: userId } } : null },
    '@/lib/prisma': { prisma },
    'next/cache': { revalidatePath: path => invalidated.push(path) },
    'next/server': { after() {} },
    '@/lib/notifications': { createTripNotification: async (_, data) => { notifications.push(data); return 'notification' } },
    '@/lib/push': { deliverNotification() {} },
  }
  function load(file) {
    const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
    const exports = {}
    vm.runInNewContext(code, { exports, require: name => { assert.ok(name in dependencies); return dependencies[name] }, console })
    return exports
  }
  return { ...load('../src/actions/savedFolders.ts'), ...load('../src/actions/bucketList.ts'), folders, saves, notifications, invalidated, itinerary }
}

test('all folder entry points require authentication', async () => {
  const h = harness(null)
  for (const result of [await h.getSavedFolders('trip'), await h.saveFolder('Beach'), await h.deleteSavedFolder('beach'), await h.addToBucketList('trip', 'beach')]) assert.ok(result.error)
  assert.equal(h.folders.size, 2)
  assert.equal(h.saves.size, 0)
})

test('folder listing and current assignment are private to the session user', async () => {
  const h = harness()
  h.saves.set('bob:trip', { folderId: 'private' })
  const result = await h.getSavedFolders('trip')
  assert.deepEqual(Array.from(result.folders, f => f.id), ['beach'])
  assert.equal(result.folderId, null)
})

test('foreign folders cannot be renamed, deleted, or used for saves', async () => {
  const h = harness()
  assert.ok((await h.saveFolder('Stolen', 'private')).error)
  await h.deleteSavedFolder('private')
  assert.equal(h.folders.get('private').name, 'Private')
  for (const id of ['private', 'missing', '', 123]) assert.ok((await h.addToBucketList('trip', id)).error)
  assert.equal(h.saves.size, 0)
  assert.equal(h.notifications.length, 0)
  for (const id of [undefined, null, '', 123]) assert.ok((await h.deleteSavedFolder(id)).error)
  assert.equal(h.folders.size, 2)
})

test('folder names are validated and normalized; duplicates show a usable error', async () => {
  const h = harness()
  for (const name of ['', '  ', 'x'.repeat(81), null, 4]) assert.ok((await h.saveFolder(name)).error)
  const created = await h.saveFolder('  Weekend trips  ')
  assert.equal(created.folder.name, 'Weekend trips')
  assert.ok((await h.saveFolder('Weekend trips')).error)
  await h.saveFolder('Long weekends', created.folder.id)
  assert.equal(h.folders.get(created.folder.id).name, 'Long weekends')
  assert.ok(h.invalidated.includes('/user/alice'))
})

test('saving and moving a trip keep one bookmark and emit only the first save notification', async () => {
  const h = harness()
  await h.addToBucketList('trip', 'beach')
  assert.equal(h.saves.get('alice:trip').folderId, 'beach')
  await h.addToBucketList('trip')
  assert.equal(h.saves.get('alice:trip').folderId, 'beach', 'ordinary saves must not reset folders')
  await h.addToBucketList('trip', null)
  assert.equal(h.saves.get('alice:trip').folderId, null)
  await h.addToBucketList('trip', 'beach')
  assert.equal(h.saves.size, 1)
  assert.equal(h.notifications.length, 1)
  assert.ok(h.invalidated.includes('/itinerary/trip'))
})

test('draft itineraries cannot be saved to a folder', async () => {
  const h = harness()
  h.itinerary.visibility = 'draft'
  assert.ok((await h.addToBucketList('trip', 'beach')).error)
  assert.equal(h.saves.size, 0)
})
