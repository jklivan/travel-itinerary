import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/tripAccess'
import { tripPhotoGallery } from '@/lib/eventPhotos'
import { findPlacePhoto } from '@/lib/placePhoto'
import { fetchStockPhoto } from '@/lib/stockPhoto'

// The pictures a trip can be shared to Instagram with (api/trip-share-image), in the order the trip shows them: its
// cover first, then its photos and its places' photos. With none of its own, Google photos of a few of its places (as its
// feed card shows), then its stock photo, then a stock photo of where it is. Only for the
// trip's own people (its creator, or someone who joined it): nobody else can put someone's trip on Instagram. Null
// otherwise.
export async function tripSharePhotos(tripId: string, userId: string) {
  const trip = await prisma.itinerary.findFirst({
    where: { id: tripId, ...canEdit(userId) },
    select: { title: true, audience: true, postType: true, bestMonths: true, datesFlexible: true, startDate: true, endDate: true, durationDays: true, coverPhoto: true, tripRating: true, budget: true,
      user: { select: { name: true, image: true } },
      photos: { select: { id: true, url: true, caption: true, isStock: true } },
      destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: { id: true, name: true, type: true, placeId: true, photoUrl: true, photoUrls: true } } } } },
  })
  if (!trip) return null
  const gallery = tripPhotoGallery(trip.photos, trip.destinations.flatMap(destination => destination.items), trip.coverPhoto).map(photo => photo.url)
  if (gallery.length) return { trip, photos: gallery }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API
  const places = trip.destinations.flatMap(destination => destination.items.filter(item => item.type !== 'transport').map(item => ({ item, destination }))).slice(0, 4)
  const google = apiKey ? (await Promise.all(places.map(({ item, destination }) => findPlacePhoto({ name: item.name, placeId: item.placeId, city: destination.name, country: destination.country, loose: false }, apiKey).catch(() => null))))
    .flatMap(photo => photo?.url ? [photo.url] : []) : []
  if (google.length) return { trip, photos: google }
  const stock = trip.photos.find(photo => photo.isStock)?.url
    ?? (trip.destinations[0] ? await fetchStockPhoto(`${trip.destinations[0].name}${trip.destinations[0].country ? ` ${trip.destinations[0].country}` : ''} travel`).catch(() => null) : null)
  return { trip, photos: stock ? [stock] : [] }
}
