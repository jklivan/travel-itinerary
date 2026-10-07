import type { Metadata } from 'next'
import Link from 'next/link'
import TripCover from '@/components/TripCover'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fetchStockPhoto } from '@/lib/stockPhoto'
import { SwipeToDeleteTrip } from '@/components/SwipeToDelete'

export const metadata: Metadata = { title: 'My Trips — Postcard' }

const tripSelect = {
  id: true, title: true, isPlan: true, publishedAt: true, coverPhoto: true,
  photos: { orderBy: { isStock: 'asc' as const }, select: { url: true, isStock: true } },
  destinations: { orderBy: { order: 'asc' as const }, select: { name: true, country: true, items: { orderBy: { order: 'asc' as const }, select: { id: true, type: true, photoUrl: true, photoUrls: true } } } },
}

// My Trips: private plans you're still working on, then the trips you've posted.
export default async function MyTripsPage() {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Ftrips')

  const [plans, postcards] = await Promise.all([
    prisma.itinerary.findMany({ where: { userId, visibility: 'draft' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: tripSelect }),
    prisma.itinerary.findMany({ where: { userId, visibility: { not: 'draft' } }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], select: tripSelect }),
  ])
  type Trip = typeof plans[number]
  const placeCount = (trip: Trip) => trip.destinations.reduce((sum, destination) => sum + destination.items.length, 0)
  const savedCover = (trip: Trip) => trip.coverPhoto ?? trip.photos.find(photo => !photo.isStock)?.url
    ?? trip.destinations.flatMap(destination => destination.items).flatMap(item => item.photoUrls.length ? item.photoUrls : item.photoUrl ? [item.photoUrl] : [])[0]
    ?? trip.photos[0]?.url ?? null
  // Trips with no photos of their own get the first place's Google photo (client side, as in the planner),
  // then a destination stock photo.
  const stock = new Map(await Promise.all([...plans, ...postcards].map(async trip => {
    const destination = trip.destinations.find(d => d.name !== 'Destination to decide')
    if (savedCover(trip) || !destination) return [trip.id, null] as const
    return [trip.id, await fetchStockPhoto(`${trip.title} ${destination.name} ${destination.country ?? ''} travel`).catch(() => null)] as const
  })))
  const cover = (trip: Trip) => ({ saved: savedCover(trip), itemId: trip.destinations.flatMap(d => d.items).find(item => item.type !== 'transport')?.id ?? null, stock: stock.get(trip.id) ?? null })

  return <div className="page-wrap">
    <header className="page-header">
      <h1 className="page-title">My trips</h1>
      <p className="page-subtitle">Plans you’re working on and trips you’ve posted.</p>
    </header>
    <TripSection title="Private plans" description="Only you can see these. Keep planning, then post when you’re ready." empty="No private plans yet.">
      {/* Plans go straight to /plan: the trip editor's redirect there fails during in-app navigation. */}
      {plans.map(trip => <TripRow key={trip.id} id={trip.id} href={`/plan/${trip.id}`} title={trip.title || 'Untitled trip'} photo={cover(trip)} detail={`${placeCount(trip)} ${placeCount(trip) === 1 ? 'place' : 'places'}`} cta="Keep planning →" />)}
    </TripSection>
    <TripSection title="Shared postcards" description="Posted trips. You can still add places and update them." empty="You haven’t posted a trip yet.">
      {postcards.map(trip => <TripRow key={trip.id} id={trip.id} href={`/itinerary/${trip.id}`} title={trip.title || 'Untitled trip'} photo={cover(trip)} detail={`${placeCount(trip)} ${placeCount(trip) === 1 ? 'place' : 'places'}${trip.publishedAt ? ` · Posted ${trip.publishedAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}`} cta="View postcard →" />)}
    </TripSection>
  </div>
}

function TripSection({ title, description, empty, children }: { title: string; description: string; empty: string; children: React.ReactNode[] }) {
  return <section className="mt-7 first-of-type:mt-0" aria-label={title}>
    <div className="mb-4"><h2 className="type-title text-brown">{title} <span className="font-sans text-sm tracking-normal">({children.length})</span></h2><p className="page-subtitle mt-1">{description}</p></div>
    {children.length ? <div className="space-y-3">{children}</div> : <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{empty}</div>}
  </section>
}

function TripRow({ id, href, title, photo, detail, cta }: { id: string; href: string; title: string; photo: { saved: string | null; itemId: string | null; stock: string | null }; detail: string; cta: string }) {
  return <SwipeToDeleteTrip id={id} title={title}><Link href={href} draggable={false} className="panel flex items-center gap-4 p-3 shadow-[0_2px_8px_rgba(45,38,27,0.08)] transition-colors hover:bg-chip">
    <span className="photo-polaroid w-24 shrink-0"><span className="photo-polaroid-image"><TripCover {...photo} /></span></span>
    <span className="min-w-0 flex-1"><span className="block break-words font-[family-name:var(--font-playfair)] text-lg leading-tight text-ink">{title}</span><span className="mt-2 block text-label font-semibold uppercase tracking-widest text-muted">{detail}</span><span className="mt-1 block text-sm text-link">{cta}</span></span>
  </Link></SwipeToDeleteTrip>
}
