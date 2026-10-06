import { prisma } from '@/lib/prisma'
import { geocode, geocodePlaceByName } from '@/lib/geocode'

// Gives a plan's destinations a map position when they don't have one yet, so places can be filed under the
// nearest destination. Destinations with a located place in them already have a position to measure against.
export async function locateDestinations(itineraryId: string) {
  const missing = await prisma.destination.findMany({
    where: { itineraryId, lat: null, name: { not: 'Destination to decide' }, items: { none: { lat: { not: null } } } },
    select: { id: true, name: true, country: true }, take: 10,
  })
  await Promise.all(missing.map(async destination => {
    const query = [destination.name, destination.country].filter(Boolean).join(', ')
    const point = await geocodePlaceByName(query) ?? await geocode(query)
    if (point) await prisma.destination.updateMany({ where: { id: destination.id, lat: null }, data: point })
  }))
}
