import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/tripAccess'
import { tripPhotoGallery } from '@/lib/eventPhotos'

// The pictures a trip can be shared to Instagram with (api/trip-share-image), in the order the trip shows them: its
// cover first, then its photos and its places' photos, or its stock photo when it has none of its own. Only for the
// trip's own people (its creator, or someone who joined it): nobody else can put someone's trip on Instagram. Null
// otherwise.
export async function tripSharePhotos(tripId: string, userId: string) {
  const trip = await prisma.itinerary.findFirst({
    where: { id: tripId, ...canEdit(userId) },
    select: { title: true, audience: true, postType: true, bestMonths: true, datesFlexible: true, startDate: true, endDate: true, durationDays: true, coverPhoto: true, tripRating: true, budget: true,
      user: { select: { name: true, image: true } },
      photos: { select: { id: true, url: true, caption: true, isStock: true } },
      destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: { id: true, name: true, type: true, photoUrl: true, photoUrls: true } } } } },
  })
  if (!trip) return null
  const gallery = tripPhotoGallery(trip.photos, trip.destinations.flatMap(destination => destination.items), trip.coverPhoto).map(photo => photo.url)
  const stock = trip.photos.find(photo => photo.isStock)?.url
  return { trip, photos: gallery.length ? gallery : stock ? [stock] : [] }
}
