import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getConversation } from '@/actions/messages'
import MessageAttachment from '@/components/MessageAttachment'
import MessageComposer from '@/components/MessageComposer'
import MessageRefresh from '@/components/MessageRefresh'

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ place?: string; before?: string }> }) {
  const { id } = await params
  const { place: placeId, before } = await searchParams
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/friends/messages/${id}${placeId ? `?place=${encodeURIComponent(placeId)}` : ''}`)}`)
  const userId = session.user.id
  if (id === userId) redirect('/friends/messages')
  const person = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!person) notFound()
  const result = await getConversation(id, before)
  if (!result.messages) notFound()
  const attachment = placeId ? await prisma.destItem.findFirst({ where: { id: placeId, destination: { itinerary: { visibility: { not: 'draft' } } } }, select: { id: true, name: true, destination: { select: { itinerary: { select: { title: true } } } } } }) : null
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <Link href="/friends/messages" className="text-sm text-[#8B6F4E]">← Inbox</Link>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#C4A882] pb-4"><h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] break-words">{person.name}</h1><MessageRefresh /></div>
    {result.hasOlder && <Link className="block mb-4 text-sm underline" href={`/friends/messages/${id}?before=${result.messages[0].id}`}>Earlier messages</Link>}
    {before && <Link href={`/friends/messages/${id}`} className="block mb-4 text-sm underline">Latest messages</Link>}
    {result.messages.length === 0 && <p className="text-sm text-[#8B6F4E]">Start a private conversation with {person.name}.</p>}
    <div className="space-y-4">{result.messages.map(message => <article key={message.id} className={`rounded-xl border border-[#d7cebc] p-4 shadow-sm ${message.senderId === userId ? 'ml-6 rounded-br-sm bg-[#e6ece5]' : 'mr-6 rounded-bl-sm bg-[#FAF7F2]'}`}>
      <p className="text-xs font-semibold text-[#507c76] mb-2">{message.senderId === userId ? 'You' : person.name}</p>
      {message.placeName && <div className="mb-3"><MessageAttachment name={message.placeName} trip={message.itineraryTitle} notes={message.placeNotes} href={message.itineraryId ? `/itinerary/${message.itineraryId}#place-${message.placeId}` : undefined} /></div>}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#2e4147]">{message.content}</p>
      <time className="mt-2 block text-xs text-[#8B6F4E]" dateTime={message.createdAt.toISOString()}>{message.createdAt.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</time>
    </article>)}</div>
    {placeId && !attachment && <p role="alert" className="mt-4 text-sm text-red-700">The attached place is no longer available.</p>}
    <MessageComposer key={`${id}:${placeId ?? 'plain'}`} recipientId={id} attachment={attachment ? { id: attachment.id, name: attachment.name, trip: attachment.destination.itinerary.title } : undefined} />
  </div>
}
