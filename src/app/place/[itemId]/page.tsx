import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/BackButton'
import ItineraryCard from '@/components/ItineraryCard'
import RatingStars from '@/components/RatingStars'
import { tripPhotoGallery } from '@/lib/eventPhotos'

const CATEGORY: Record<string, string> = { hotel: 'Hotel', food_drink: 'Food & drink', activity: 'Activity', transport: 'Transportation' }

// Every shared trip that includes a place (same category, and the same Google place or the same name),
// with each poster's rating. Reached from "Community rating" in a place's details.
export default async function PlacePage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const userId = (await auth())?.user?.id ?? null
  const item = await prisma.destItem.findUnique({ where: { id: itemId }, select: { name: true, type: true, placeId: true, destination: { select: { name: true, country: true, itinerary: { select: { visibility: true, userId: true } } } } } })
  if (!item || (item.destination.itinerary.visibility === 'draft' && item.destination.itinerary.userId !== userId)) notFound()

  // The same Google place in any category, or the same name in the same category (as on trip pages).
  const samePlace = { OR: [...(item.placeId ? [{ placeId: item.placeId }] : []), { type: item.type, name: { equals: item.name, mode: 'insensitive' as const } }] }
  const [trips, bucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: { visibility: { not: 'draft' }, destinations: { some: { items: { some: samePlace } } } },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, id: true, image: true } },
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { orderBy: { isStock: 'asc' } },
        _count: { select: { bucketedBy: true } },
      },
    }),
    userId ? prisma.bucketListItem.findMany({ where: { userId }, select: { itineraryId: true } }) : Promise.resolve([]),
  ])
  const bucketSet = new Set(bucketIds.map(bucket => bucket.itineraryId))
  const lowerName = item.name.toLowerCase()
  // Each trip's own rating for this place (its best, if it lists the place twice).
  const tripRating = (trip: typeof trips[number]) => Math.max(0, ...trip.destinations.flatMap(destination => destination.items)
    .filter(other => (item.placeId && other.placeId === item.placeId) || (other.type === item.type && other.name.toLowerCase() === lowerName))
    .map(other => other.rating ?? 0)) || null
  const ratings = trips.map(tripRating).filter((rating): rating is number => !!rating)
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null

  return <div className="mx-auto max-w-xl px-5 py-6 text-ink sm:px-8">
    <BackButton fallback="/explore" className="mb-5 inline-block text-sm text-ink-soft hover:underline">← Back</BackButton>
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-link">{CATEGORY[item.type] ?? 'Place'} · {[item.destination.name, item.destination.country].filter(Boolean).join(', ')}</p>
    <h1 className="trip-title mt-2 font-[family-name:var(--font-playfair)] text-3xl text-ink">{item.name}</h1>
    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
      {average !== null ? <><RatingStars value={average} label={`Community rating ${average.toFixed(1)} out of 5`} /><span>{average.toFixed(1)} · {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}</span></> : <span>No ratings yet</span>}
      <span>· {trips.length} {trips.length === 1 ? 'trip' : 'trips'}</span>
    </p>
    <div className="mt-6 space-y-6">
      {trips.map(trip => {
        const rating = tripRating(trip)
        return <section key={trip.id} aria-label={`${trip.user.name}: ${trip.title}`}>
          <p className="mb-2 flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-link">{trip.user.id === userId ? 'You' : trip.user.name}</span>{rating ? <RatingStars value={rating} label={`${trip.user.name} rated it ${rating} out of 5`} /> : <span className="text-muted">went, no rating</span>}</p>
          <ItineraryCard fullWidth id={trip.id} postType={trip.postType} tags={trip.tags} durationDays={trip.durationDays} title={trip.title} bestMonths={trip.bestMonths}
            datesFlexible={trip.datesFlexible} startDate={trip.startDate} endDate={trip.endDate} audience={trip.audience} budget={trip.budget} tripRating={trip.tripRating}
            authorName={trip.user.name} authorImage={trip.user.image} authorId={trip.user.id} destinations={trip.destinations} coverPhoto={trip.photos[0]?.url ?? null}
            photos={tripPhotoGallery(trip.photos, trip.destinations.flatMap(destination => destination.items))} currentUserId={userId}
            isOwn={trip.user.id === userId} isBucketed={bucketSet.has(trip.id)} saveCount={trip._count.bucketedBy} />
        </section>
      })}
    </div>
  </div>
}
