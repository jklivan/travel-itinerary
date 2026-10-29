import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import UserAvatar from '@/components/UserAvatar'
import { tripLocationLabel } from '@/lib/tripLocation'
import JoinTrip from './JoinTrip'

// Joining a group trip (#116): from an invite (/join/<trip id>) or a shared link (/join/<link code>).
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const userId = (await auth())?.user?.id
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/join/${code}`)}`)
  const link = await prisma.tripMember.findFirst({ where: { token: code, userId: null }, select: { itineraryId: true } })
  const tripId = link?.itineraryId ?? code
  const trip = await prisma.itinerary.findUnique({ where: { id: tripId }, select: {
    id: true, title: true, userId: true, user: { select: { name: true, image: true } },
    members: { where: { userId: { not: null }, status: { in: ['invited', 'joined'] } }, select: { userId: true, status: true, user: { select: { name: true, image: true } } } },
    destinations: { select: { name: true, country: true, items: { select: { type: true } } } },
  } })
  if (!trip) notFound()
  if (trip.userId === userId) redirect(`/plan/${trip.id}`)
  const mine = trip.members.find(member => member.userId === userId)
  if (mine?.status === 'joined') redirect(`/plan/${trip.id}`)
  // A personal invite needs one waiting for you; a link works for anyone signed in.
  if (!link && mine?.status !== 'invited') return <div className="page-wrap"><div className="panel-dashed p-8 text-center"><h1 className="type-title">This invitation isn’t open</h1><p className="mt-2 text-sm text-muted">Ask {trip.user.name} to invite you again.</p></div></div>
  const places = trip.destinations.reduce((sum, destination) => sum + destination.items.length, 0)
  const joined = trip.members.filter(member => member.status === 'joined')
  const where = tripLocationLabel(trip.destinations)
  return <div className="page-wrap">
    <div className="panel mx-auto max-w-md p-6 text-center">
      <div className="flex justify-center"><UserAvatar name={trip.user.name} image={trip.user.image} size={56} /></div>
      <p className="mt-3 text-sm text-muted">{trip.user.name} invited you to plan a trip together</p>
      <h1 className="type-display mt-2 break-words">{trip.title}</h1>
      {where && <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-brown">{where}</p>}
      <p className="mt-3 text-sm text-ink-soft">{places} {places === 1 ? 'place' : 'places'} so far{joined.length ? ` · ${joined.length} ${joined.length === 1 ? 'person has' : 'people have'} joined` : ''}</p>
      {joined.length > 0 && <div className="mt-3 flex justify-center -space-x-2">{joined.slice(0, 6).map(member => <UserAvatar key={member.userId} name={member.user?.name ?? ''} image={member.user?.image} size={32} className="ring-2 ring-card" />)}</div>}
      <p className="mt-4 text-sm text-muted">Everyone on the trip can add and change places. Your stars, notes and photos stay your own.</p>
      <JoinTrip code={code} />
    </div>
  </div>
}
