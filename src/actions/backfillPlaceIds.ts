'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolvePlaceIdentity } from '@/lib/placeIdentity'
import { revalidatePath } from 'next/cache'

export async function backfillPlaceIds({ after = '', apply = false }: { after?: string; apply?: boolean }) {
  const session = await auth()
  if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) return { error: 'Administrator sign-in required.', rows: [], next: null }
  if (typeof after !== 'string' || after.length > 200 || typeof apply !== 'boolean') return { error: 'Invalid batch request.', rows: [], next: null }
  const items = await prisma.destItem.findMany({
    where: { OR: [{ placeId: null }, { placeId: '' }], name: { not: '' }, ...(after ? { id: { gt: after } } : {}) },
    orderBy: { id: 'asc' }, take: 5,
    select: { id: true, name: true, lat: true, lng: true, destinationId: true, destination: { select: { name: true, country: true, lat: true, lng: true } } },
  })
  const rows = []
  for (const item of items) {
    try {
      const result = await resolvePlaceIdentity(item)
      let saved = false
      if (apply && result.match) {
        // A concurrent edit or autocomplete selection must never be overwritten.
        const updated = await prisma.destItem.updateMany({ where: { id: item.id, name: item.name, destinationId: item.destinationId, OR: [{ placeId: null }, { placeId: '' }], destination: { name: item.destination.name, country: item.destination.country } }, data: { placeId: result.match.id! } })
        saved = updated.count === 1
      }
      rows.push({ id: item.id, name: item.name, destination: item.destination.name, matchedName: result.match?.displayName?.text ?? '', address: result.match?.formattedAddress ?? '', placeId: result.match?.id ?? null, status: saved ? 'saved' : result.match ? apply ? 'changed' : 'matched' : 'skipped', reason: result.reason })
    } catch (error) {
      rows.push({ id: item.id, name: item.name, destination: item.destination.name, matchedName: '', address: '', placeId: null, status: 'error', reason: error instanceof Error ? error.message : 'Lookup failed.' })
    }
  }
  if (apply) { revalidatePath('/'); revalidatePath('/plan'); revalidatePath('/itinerary/[id]', 'page') }
  return { rows, next: items.length === 5 ? items.at(-1)!.id : null }
}
