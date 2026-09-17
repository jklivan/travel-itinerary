import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getConversation } from '@/actions/messages'
import MessageThread from '@/components/MessageThread'
import MessageRefresh from '@/components/MessageRefresh'
import MarkMessagesRead from '@/components/MarkMessagesRead'

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ place?: string; trip?: string; before?: string }> }) {
  const { id } = await params
  const { place: placeId, trip: tripId, before } = await searchParams
  const context = new URLSearchParams()
  if (placeId) context.set('place', placeId)
  else if (tripId) context.set('trip', tripId)
  const conversationHref = `/messages/${id}${context.size ? `?${context}` : ''}`
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(conversationHref)}`)
  const userId = session.user.id
  if (id === userId) redirect('/messages')
  const person = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!person) notFound()
  const result = await getConversation(id, before)
  if (!result.messages) notFound()
  const attachment = placeId ? await prisma.destItem.findFirst({ where: { id: placeId, destination: { itinerary: { visibility: { not: 'draft' } } } }, select: { id: true, name: true, destination: { select: { itinerary: { select: { title: true } } } } } }) : null
  const trip = !placeId && tripId ? await prisma.itinerary.findFirst({ where: { id: tripId, visibility: { not: 'draft' } }, select: { id: true, title: true } }) : null
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <MarkMessagesRead senderId={id} messageIds={result.messages.filter(message => message.recipientId === userId).map(message => message.id)} />
    <Link href="/messages" className="text-sm text-[#8B6F4E]">← Inbox</Link>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#C4A882] pb-4"><h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] break-words">{person.name}</h1><MessageRefresh /></div>
    {result.hasOlder && <Link className="block mb-4 text-sm underline" href={`${conversationHref}${context.size ? '&' : '?'}before=${result.messages[0].id}`}>Earlier messages</Link>}
    {before && <Link href={conversationHref} className="block mb-4 text-sm underline">Latest messages</Link>}
    {result.messages.length === 0 && <p className="text-sm text-[#8B6F4E]">Start a private conversation with {person.name}.</p>}
    {placeId && !attachment && <p role="alert" className="mt-4 text-sm text-red-700">The attached place is no longer available.</p>}
    {tripId && !placeId && !trip && <p role="alert" className="mt-4 text-sm text-red-700">The attached trip is no longer available.</p>}
    <MessageThread messages={result.messages} userId={userId} person={person} key={`${id}:${placeId ? `place:${placeId}` : tripId ? `trip:${tripId}` : 'plain'}`} attachment={attachment ? { kind: 'place', id: attachment.id, name: attachment.name, trip: attachment.destination.itinerary.title } : trip ? { kind: 'trip', id: trip.id, name: trip.title } : undefined} />
  </div>
}
