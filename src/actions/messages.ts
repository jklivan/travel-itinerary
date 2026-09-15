'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getConversation(recipientId: string, before?: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to read messages.' }
  const userId = session.user.id
  const participants = { OR: [{ senderId: userId, recipientId }, { senderId: recipientId, recipientId: userId }] }
  // A cursor must belong to this conversation, too.
  if (before && !await prisma.directMessage.findFirst({ where: { id: before, ...participants }, select: { id: true } })) {
    return { error: 'Message not found.' }
  }
  const messages = await prisma.directMessage.findMany({
    where: participants,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 101,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  })
  return { messages: messages.slice(0, 100).reverse(), hasOlder: messages.length > 100 }
}

export async function getMessageInbox() {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to read messages.' }
  const userId = session.user.id
  const latest = await prisma.directMessage.findMany({
    where: { OR: [{ senderId: userId }, { recipientId: userId }] },
    distinct: ['senderId', 'recipientId'],
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { sender: { select: { id: true, name: true } }, recipient: { select: { id: true, name: true } } },
  })
  const seen = new Set<string>()
  return { threads: latest.flatMap(message => {
    const person = message.senderId === userId ? message.recipient : message.sender
    if (seen.has(person.id)) return []
    seen.add(person.id)
    return [{ person, content: message.content, placeName: message.placeName, createdAt: message.createdAt }]
  }) }
}

export async function sendDirectMessage(input: { recipientId: string; content: string; clientId: string; placeId?: string }) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to send a message.' }
  if (!input || typeof input.content !== 'string' || !input.content.trim() || input.content.trim().length > 4000) return { error: 'Write a message of up to 4,000 characters.' }
  if (typeof input.clientId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.clientId)) return { error: 'Please try sending again.' }
  if (typeof input.recipientId !== 'string' || input.recipientId === session.user.id) return { error: 'Choose another traveler to message.' }
  if (!await prisma.user.findUnique({ where: { id: input.recipientId }, select: { id: true } })) return { error: 'Traveler not found.' }
  let attachment = {}
  if (input.placeId) {
    if (typeof input.placeId !== 'string') return { error: 'Place not found.' }
    const place = await prisma.destItem.findFirst({
      where: { id: input.placeId, destination: { itinerary: { visibility: { not: 'draft' } } } },
      include: { destination: { include: { itinerary: { select: { id: true, title: true } } } } },
    })
    if (!place) return { error: 'This place is no longer available. Remove the attachment to send your message.' }
    attachment = { placeId: place.id, placeName: place.name, placeNotes: place.notes, itineraryId: place.destination.itinerary.id, itineraryTitle: place.destination.itinerary.title }
  }
  // Retry a timed-out send without delivering the same message twice.
  await prisma.directMessage.upsert({
    where: { senderId_clientId: { senderId: session.user.id, clientId: input.clientId } },
    update: {},
    create: { senderId: session.user.id, recipientId: input.recipientId, content: input.content.trim(), clientId: input.clientId, ...attachment },
  })
  revalidatePath('/friends/messages')
  revalidatePath(`/friends/messages/${input.recipientId}`)
  return { success: true }
}
