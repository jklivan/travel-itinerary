import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Planner from './Planner'

export const maxDuration = 300

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ import?: string; details?: string; post?: string }> }) {
  const { id } = await params
  const search = await searchParams
  const importing = search.import === '1'
  const initialPost = search.post === '1'
  const userId = (await auth())?.user?.id
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/plan/${id}`)}`)
  const trip = await prisma.itinerary.findFirst({ where: { id, userId }, include: { photos: { where: { isStock: false }, select: { url: true } }, destinations: { orderBy: { order: 'asc' }, include: { items: { orderBy: { order: 'asc' }, include: { sourceItinerary: { select: { id: true, title: true, visibility: true } }, sourceUser: { select: { id: true, name: true } } } } } } } })
  if (!trip) notFound()
  return <Planner initialImport={importing} initialDetails={search.details === '1'} initialPost={initialPost} trip={{ id: trip.id, title: trip.title, audience: trip.audience, isPlan: trip.isPlan, visibility: trip.visibility,
    postType: trip.postType, durationDays: trip.durationDays, budget: trip.budget, tripRating: trip.tripRating, tags: trip.tags, notes: trip.notes, bestMonths: trip.bestMonths, coverPhoto: trip.coverPhoto, tripPhotos: trip.photos.map(photo => photo.url),
    start: trip.datesFlexible ? '' : trip.startDate.toISOString().slice(0, 10), end: trip.datesFlexible ? '' : trip.endDate.toISOString().slice(0, 10),
    destinations: trip.destinations.map(d => ({ id: d.id, name: d.name, country: d.country, days: d.days, items: d.items.map(item => ({ id: item.id, order: item.order,
      // Where the idea came from (a trip, a snapshot or Plan with AI). Your own trips and snapshots don't need saying.
      source: item.sourceKind && item.sourceUser?.id !== userId ? { kind: item.sourceKind, person: item.sourceUser?.name ?? null,
        trip: item.sourceItinerary && item.sourceItinerary.visibility !== 'draft' ? { id: item.sourceItinerary.id, title: item.sourceItinerary.title } : null } : null, nights: item.nights, name: item.name, placeId: item.placeId, lat: item.lat, lng: item.lng, type: item.type, notes: item.notes, tags: item.tags, status: item.planningStatus,
      day: item.dayIndex === null ? null : item.dayIndex + (d.items.some(i => i.type !== 'hotel' && i.dayIndex === 0) ? 1 : 0),
      photos: item.photoUrls.length ? item.photoUrls : item.photoUrl ? [item.photoUrl] : [], rating: item.rating,
      mealType: item.mealType, alternative: item.alternative, description: item.description, link: item.link, address: item.address,
    })) })),
  }} />
}
