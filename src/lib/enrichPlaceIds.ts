import { prisma } from '@/lib/prisma'
import { resolvePlaceIdentity } from './placeIdentity'

// near: where a place actually is when it's filed under another destination (an import of Greenwich notes that
// includes a Westport restaurant). It's tried first, then the destination the place is filed under.
export async function enrichPlaceIds(ids: string[], near = new Map<string, { name: string; country: string }>()) {
  const items = await prisma.destItem.findMany({ where: { type: { not: 'transport' }, id: { in: ids }, OR: [{ placeId: null }, { placeId: '' }] }, select: { id: true, name: true, lat: true, lng: true, address: true, destinationId: true, destination: { select: { name: true, country: true, lat: true, lng: true } } } })
  for (let index = 0; index < items.length; index += 5) {
    await Promise.allSettled(items.slice(index, index + 5).map(async item => {
      const hint = near.get(item.id)
      let { match } = hint ? await resolvePlaceIdentity({ ...item, destination: { name: hint.name, country: hint.country || item.destination.country } }) : { match: null }
      if (!match) ({ match } = await resolvePlaceIdentity(item))
      if (!match) return
      // Its Google address too, so the card shows the place's own town.
      await prisma.destItem.updateMany({ where: { id: item.id, name: item.name, destinationId: item.destinationId, OR: [{ placeId: null }, { placeId: '' }], destination: { name: item.destination.name, country: item.destination.country } }, data: { placeId: match.id!, ...(!item.address && match.formattedAddress ? { address: match.formattedAddress.slice(0, 500) } : {}) } })
    }))
  }
}
