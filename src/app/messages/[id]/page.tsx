
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getConversation, unreadMessageIds } from '@/actions/messages'
import MessageThread from '@/components/MessageThread'
import MessageRefresh from '@/components/MessageRefresh'
import MarkMessagesRead from '@/components/MarkMessagesRead'
import { messageThreadHref } from '@/lib/messageThread'

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ place?: string; trip?: string; before?: string }> }) {
  const { id } = await params
  const { place: placeId, trip: requestedTripId, before } = await searchParams
  const loginContext = new URLSearchParams()
  if (placeId) loginContext.set('place', placeId)
  if (requestedTripId) loginContext.set('trip', requestedTripId)
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/messages/${id}${loginContext.size ? `?${loginContext}` : ''}`)}`)
  const userId = session.user.id
  if (id === userId) redirect('/messages')
  const person = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!person) notFound()
  const attachment = placeId ? await prisma.destItem.findFirst({ where: { id: placeId, destination: { itinerary: { visibility: { not: 'draft' } } } }, select: { id: true, name: true, destination: { select: { itinerary: { select: { id: true, title: true } } } } } }) : null
  if (placeId && !attachment && !requestedTripId) notFound()
  if (attachment && requestedTripId && attachment.destination.itinerary.id !== requestedTripId) notFound()
  const tripId = attachment?.destination.itinerary.id ?? requestedTripId
  const result = await getConversation(id, before, tripId)
  if (!result.messages) notFound()
  // Looked up before they're marked read, so the new ones can be highlighted on this visit.
  const newIds = await unreadMessageIds(result.messages.filter(message => message.recipientId === userId).map(message => message.id))
  const trip = tripId ? await prisma.itinerary.findFirst({ where: { id: tripId, visibility: { not: 'draft' } }, select: { id: true, title: true } }) : null
  const previous = tripId && !trip ? await prisma.directMessage.findFirst({ where: { itineraryId: tripId, OR: [{ senderId: userId, recipientId: id }, { senderId: id, recipientId: userId }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { itineraryTitle: true } }) : null
  if (tripId && !trip && !previous) notFound()
  const title = tripId ? trip?.title ?? previous?.itineraryTitle ?? 'Trip conversation' : 'General conversation'
  const conversationHref = messageThreadHref(id, tripId)
  const pageHref = attachment ? `${conversationHref}&place=${encodeURIComponent(attachment.id)}` : conversationHref
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <MarkMessagesRead senderId={id} messageIds={result.messages.filter(message => message.recipientId === userId).map(message => message.id)} />
    <div className="my-5 flex flex-wrap items-center justify-between gap-3 border-b border-line-strong pb-4"><div><h1 className="font-[family-name:var(--font-playfair)] text-title text-ink break-words">{attachment?.name ?? person.name}</h1>{attachment && <p className="mt-1 text-sm text-brown">Conversation with {person.name}</p>}{trip ? <Link href={`/itinerary/${trip.id}`} className="mt-2 block text-sm font-semibold text-link underline">{title}</Link> : <p className="mt-2 text-sm font-semibold text-link">{title}</p>}<p className="mt-1 text-xs text-brown">{tripId ? 'A separate conversation for this trip.' : 'Messages without a trip attached.'}</p></div><MessageRefresh /></div>
    {result.hasOlder && <Link className="block mb-4 text-sm underline" href={`${pageHref}${tripId ? '&' : '?'}before=${result.messages[0].id}`}>Earlier messages</Link>}
    {before && <Link href={pageHref} className="block mb-4 text-sm underline">Latest messages</Link>}
    {result.messages.length === 0 && <p className="text-sm text-brown">Start a private conversation with {person.name}{tripId ? ` about ${title}` : ''}.</p>}
    {placeId && !attachment && <p role="alert" className="mt-4 text-sm text-danger">The attached place is no longer available.</p>}
    {tripId && !trip && <p className="mt-4 text-sm text-brown">This trip is no longer shared, but you can continue your conversation here.</p>}
    <MessageThread messages={result.messages} newIds={newIds} userId={userId} person={person} itineraryId={tripId} key={`${id}:${tripId ?? 'general'}:${placeId ?? ''}`} attachment={attachment ? { kind: 'place', id: attachment.id, name: attachment.name, trip: attachment.destination.itinerary.title } : undefined} />
  </div>
}
