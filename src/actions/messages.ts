'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { deliverNotification } from '@/lib/push'

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
    include: { replyTo: { select: { id: true, senderId: true, content: true, itineraryTitle: true, placeName: true } } },
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
    return [{ person, content: message.content, placeName: message.placeName, itineraryTitle: message.itineraryTitle, createdAt: message.createdAt }]
  }) }
}

export async function messageItineraries(query = '') {
  const userId = (await auth())?.user?.id
  if (!userId || typeof query !== 'string' || query.length > 160) return []
  return prisma.itinerary.findMany({
    where: { userId, visibility: 'public', ...(query.trim() ? { title: { contains: query.trim(), mode: 'insensitive' as const } } : {}) },
    select: { id: true, title: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
  })
}

export async function sendDirectMessage(input: { recipientId: string; content: string; clientId: string; placeId?: string; itineraryId?: string; replyToId?: string }) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Sign in to send a message.' }
  const senderId = session.user.id
  if (!input || typeof input.content !== 'string' || input.content.trim().length > 4000 || (!input.content.trim() && !input.placeId && !input.itineraryId)) return { error: 'Write a message of up to 4,000 characters.' }
  if (typeof input.clientId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.clientId)) return { error: 'Please try sending again.' }
  if (typeof input.recipientId !== 'string' || input.recipientId === session.user.id) return { error: 'Choose another traveler to message.' }
  if (!await prisma.user.findUnique({ where: { id: input.recipientId }, select: { id: true } })) return { error: 'Traveler not found.' }
  let attachment = {}
  if (input.replyToId) {
    if (typeof input.replyToId !== 'string') return { error: 'Message not found.' }
    const original = await prisma.directMessage.findFirst({
      where: { id: input.replyToId, OR: [{ senderId: session.user.id, recipientId: input.recipientId }, { senderId: input.recipientId, recipientId: session.user.id }] },
    })
    if (!original) return { error: 'The message you are replying to is no longer available.' }
    attachment = { itineraryId: original.itineraryId, itineraryTitle: original.itineraryTitle, placeId: original.placeId, placeName: original.placeName, placeNotes: original.placeNotes }
  }
  if (input.placeId) {
    if (typeof input.placeId !== 'string') return { error: 'Place not found.' }
    const place = await prisma.destItem.findFirst({
      where: { id: input.placeId, destination: { itinerary: { visibility: { not: 'draft' } } } },
      include: { destination: { include: { itinerary: { select: { id: true, title: true } } } } },
    })
    if (!place) return { error: 'This place is no longer available. Remove the attachment to send your message.' }
    attachment = { placeId: place.id, placeName: place.name, placeNotes: place.notes, itineraryId: place.destination.itinerary.id, itineraryTitle: place.destination.itinerary.title }
  } else if (input.itineraryId) {
    if (typeof input.itineraryId !== 'string') return { error: 'Trip not found.' }
    const trip = await prisma.itinerary.findFirst({
      where: { id: input.itineraryId, visibility: { not: 'draft' } },
      select: { id: true, title: true },
    })
    if (!trip) return { error: 'This trip is no longer available. Remove the attachment to send your message.' }
    attachment = { itineraryId: trip.id, itineraryTitle: trip.title }
  }
  // Save the message and alert atomically; retries must not duplicate either.
  const notificationId = await prisma.$transaction(async tx => {
    const message = await tx.directMessage.upsert({
      where: { senderId_clientId: { senderId, clientId: input.clientId } },
      update: {},
      create: { senderId, recipientId: input.recipientId, content: input.content.trim(), clientId: input.clientId, replyToId: input.replyToId || null, ...attachment },
    })
    const notifications = await tx.notification.createManyAndReturn({
      data: [{ recipientId: message.recipientId, actorId: message.senderId, kind: 'message', messageId: message.id, dedupeKey: `message:${message.id}` }],
      skipDuplicates: true,
      select: { id: true },
    })
    return notifications[0]?.id
  })
  if (notificationId) after(() => deliverNotification(notificationId))
  revalidatePath('/messages')
  revalidatePath(`/messages/${input.recipientId}`)
  revalidatePath('/notifications')
  return { success: true }
}

export async function markMessagesRead(senderId: string, messageIds: string[]) {
  const session = await auth()
  if (!session?.user?.id) return
  if (typeof senderId !== 'string' || !Array.isArray(messageIds) || messageIds.length > 100 || messageIds.some(id => typeof id !== 'string')) return
  if (!messageIds.length) return
  const result = await prisma.notification.updateMany({
    where: {
      recipientId: session.user.id, actorId: senderId, kind: 'message', readAt: null,
      messageId: { in: messageIds },
      message: { senderId, recipientId: session.user.id },
    },
    data: { readAt: new Date() },
  })
  if (result.count) {
    revalidatePath('/notifications')
    revalidatePath('/messages')
  }
}
