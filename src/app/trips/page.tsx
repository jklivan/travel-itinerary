import type { Metadata } from 'next'
import Link from 'next/link'
import TripCover from '@/components/TripCover'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fetchStockPhoto } from '@/lib/stockPhoto'
import { SwipeToDeleteTrip } from '@/components/SwipeToDelete'
import { canEdit } from '@/lib/tripAccess'
import UserAvatar from '@/components/UserAvatar'

export const metadata: Metadata = { title: 'My Trips — Postcard' }

const tripSelect = {
  id: true, title: true, isPlan: true, publishedAt: true, coverPhoto: true, coverFocus: true,
  // Group trips: who started it and who's invited or joined.
  userId: true, user: { select: { name: true, image: true } },
  members: { where: { userId: { not: null }, status: { in: ['invited', 'joined'] } }, orderBy: { createdAt: 'asc' as const }, select: { status: true, user: { select: { name: true, image: true } } } },
  photos: { orderBy: { isStock: 'asc' as const }, select: { url: true, isStock: true } },
  destinations: { orderBy: { order: 'asc' as const }, select: { name: true, country: true, items: { orderBy: { order: 'asc' as const }, select: { id: true, type: true, photoUrl: true, photoUrls: true } } } },
}

// My Trips: private plans you're still working on (yours and group trips you've joined), then the trips you've posted.
export default async function MyTripsPage() {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Ftrips')

  const [plans, postcards, invites, unreadChat] = await Promise.all([
    prisma.itinerary.findMany({ where: { visibility: 'draft', ...canEdit(userId) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: tripSelect }),
    prisma.itinerary.findMany({ where: { userId, visibility: { not: 'draft' } }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], select: tripSelect }),
    // Group trips you've been invited to and haven't answered yet.
    prisma.tripMember.findMany({ where: { userId, status: 'invited' }, orderBy: { createdAt: 'desc' }, select: { itinerary: { select: { id: true, title: true } }, invitedBy: { select: { name: true, image: true } } } }),
    // Group trips with chat messages you haven't read.
    prisma.notification.findMany({ where: { recipientId: userId, kind: 'trip_chat', readAt: null }, select: { itineraryId: true } }),
  ])
  const unread = new Set(unreadChat.map(row => row.itineraryId))
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
  const cover = (trip: Trip) => ({ saved: savedCover(trip), focus: trip.coverPhoto ? trip.coverFocus : null, itemId: trip.destinations.flatMap(d => d.items).find(item => item.type !== 'transport')?.id ?? null, stock: stock.get(trip.id) ?? null })

  return <div className="page-wrap">
    <header className="page-header">
      <h1 className="page-title">My trips</h1>
      <p className="page-subtitle">Plans you’re working on and trips you’ve posted.</p>
    </header>
    {invites.length > 0 && <section aria-label="Invitations" className="mb-7 space-y-2">
      {invites.map(invite => <Link key={invite.itinerary.id} href={`/join/${invite.itinerary.id}`} className="panel-hint flex items-center gap-3 p-3 text-sm text-ink">
        <UserAvatar name={invite.invitedBy.name} image={invite.invitedBy.image} size={32} />
        <span className="min-w-0 flex-1"><span className="font-semibold">{invite.invitedBy.name}</span> invited you to plan <span className="font-semibold">“{invite.itinerary.title}”</span> together</span>
        <span className="shrink-0 text-xs font-semibold text-link">Join or decline →</span>
      </Link>)}
    </section>}
    <TripSection title="Private plans" description="Only you, and anyone you’re planning with, can see these. Keep planning, then post when you’re ready." empty="No private plans yet.">
      {/* Plans go straight to /plan: the trip editor's redirect there fails during in-app navigation. */}
      {plans.map(trip => <TripRow key={trip.id} id={trip.id} href={`/plan/${trip.id}`} title={trip.title || 'Untitled trip'} photo={cover(trip)} detail={`${placeCount(trip)} ${placeCount(trip) === 1 ? 'place' : 'places'}`} cta="Keep planning →" own={trip.userId === userId} newMessages={unread.has(trip.id)}
        people={trip.members.length ? { joined: [trip.user, ...trip.members.filter(member => member.status === 'joined').map(member => member.user!)], invited: trip.members.filter(member => member.status === 'invited').length } : undefined} />)}
    </TripSection>
    <TripSection title="Shared postcards" description="Posted trips. You can still add places and update them." empty="You haven’t posted a trip yet.">
      {postcards.map(trip => <TripRow key={trip.id} id={trip.id} href={`/itinerary/${trip.id}`} title={trip.title || 'Untitled trip'} photo={cover(trip)} detail={`${placeCount(trip)} ${placeCount(trip) === 1 ? 'place' : 'places'}${trip.publishedAt ? ` · Posted ${trip.publishedAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}`} cta="View postcard →" />)}
    </TripSection>
  </div>
}

function TripSection({ title, description, empty, children }: { title: string; description: string; empty: string; children: React.ReactNode[] }) {
  return <section className="mt-7 first-of-type:mt-0" aria-label={title}>
    <div className="mb-4"><h2 className="type-title text-brown">{title} <span className="font-sans text-sm tracking-normal">({children.length})</span></h2><p className="page-subtitle mt-1">{description}</p></div>
    {children.length ? <div className="space-y-3">{children}</div> : <div className="panel-dashed p-6 text-center text-sm text-muted">{empty}</div>}
  </section>
}

function TripRow({ id, href, title, photo, detail, cta, own = true, people, newMessages = false }: { newMessages?: boolean; id: string; href: string; title: string; photo: { saved: string | null; itemId: string | null; stock: string | null; focus?: string | null }; detail: string; cta: string; own?: boolean
  // Group trips: everyone planning it (the creator first) and how many are invited.
  people?: { joined: { name: string; image: string | null }[]; invited: number } }) {
  const row = <Link href={href} draggable={false} className="panel flex items-center gap-4 p-3 shadow-card transition-colors hover:bg-chip">
    <span className="photo-polaroid w-24 shrink-0"><span className="photo-polaroid-image"><TripCover {...photo} /></span></span>
    <span className="min-w-0 flex-1"><span className="block break-words font-[family-name:var(--font-playfair)] text-lg leading-tight text-ink">{title}</span><span className="mt-2 block text-label font-semibold uppercase tracking-widest text-muted">{detail}</span>{people && <span className="mt-1.5 flex items-center gap-1.5"><span className="flex -space-x-1.5">{people.joined.slice(0, 4).map((person, index) => <UserAvatar key={index} name={person.name} image={person.image} size={20} className="ring-2 ring-card" />)}</span><span className="text-xs text-muted">{people.joined.length} planning{people.invited ? ` · ${people.invited} invited` : ''}</span></span>}{newMessages && <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-link"><span aria-hidden="true" className="size-2 rounded-full bg-danger" />New messages</span>}<span className="mt-1 block text-sm text-link">{cta}</span></span>
  </Link>
  // Only the creator can delete a trip; someone who joined leaves it from inside the plan.
  return own ? <SwipeToDeleteTrip id={id} title={title}>{row}</SwipeToDeleteTrip> : row
}
