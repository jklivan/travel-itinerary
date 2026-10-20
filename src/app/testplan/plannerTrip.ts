import { placeTown } from '@/lib/placeTown'
import { prisma } from '@/lib/prisma'

// The trip as Plan with AI's "Your trip" box shows it: its places with their day, photos and town.
export const plannerTripQuery = { destinations: { orderBy: { order: 'asc' as const }, include: { items: { orderBy: { order: 'asc' as const } } } } }
type TripRow = NonNullable<Awaited<ReturnType<typeof findPlannerTrip>>>
export function findPlannerTrip(userId: string, tripId: string) {
  return prisma.itinerary.findFirst({ where: { id: tripId, userId }, include: plannerTripQuery })
}
export function plannerTripProps(trip: TripRow) {
  return { id: trip.id, title: trip.title,
    places: trip.destinations.flatMap(d => d.items.map(item => ({ id: item.id, name: item.name, type: item.type, notes: item.notes, placeId: item.placeId, lat: item.lat, lng: item.lng,
      day: item.dayIndex === null ? null : item.dayIndex + (d.items.some(i => i.type !== 'hotel' && i.dayIndex === 0) ? 1 : 0),
      photos: item.photoUrls.length ? item.photoUrls : item.photoUrl ? [item.photoUrl] : [],
      destination: item.address ? placeTown(item.address) : [d.name, d.country].filter(Boolean).join(', ') }))) }
}
