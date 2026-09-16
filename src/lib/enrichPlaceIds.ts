import { prisma } from '@/lib/prisma'
import { resolvePlaceIdentity } from './placeIdentity'

export async function enrichPlaceIds(ids: string[]) {
  const items = await prisma.destItem.findMany({ where: { id: { in: ids }, OR: [{ placeId: null }, { placeId: '' }] }, select: { id: true, name: true, lat: true, lng: true, destinationId: true, destination: { select: { name: true, country: true, lat: true, lng: true } } } })
  for (let index = 0; index < items.length; index += 5) {
    await Promise.allSettled(items.slice(index, index + 5).map(async item => {
      const { match } = await resolvePlaceIdentity(item)
      if (!match) return
      await prisma.destItem.updateMany({ where: { id: item.id, name: item.name, destinationId: item.destinationId, OR: [{ placeId: null }, { placeId: '' }], destination: { name: item.destination.name, country: item.destination.country } }, data: { placeId: match.id! } })
    }))
  }
}
