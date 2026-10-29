'use server'

import { after } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { deliverNotification } from '@/lib/push'
import { canEdit } from '@/lib/tripAccess'

// A group trip's chat (#116): only the people on the trip read or write it. Someone writing alerts the others once
// (one alert per trip until they open it, so a burst of messages doesn't keep buzzing); opening the trip clears it.

export type TripChatMessage = { id: string; body: string; at: string; userId: string; name: string; image: string | null }
const me = async () => (await auth())?.user?.id ?? null
const LIMIT = 2000

export async function tripMessages(tripId: string, since?: string): Promise<TripChatMessage[]> {
  const userId = await me()
  if (!userId || !await prisma.itinerary.count({ where: { id: tripId, ...canEdit(userId) } })) return []
  const from = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : null
  const rows = await prisma.tripMessage.findMany({
    where: { itineraryId: tripId, ...(from ? { createdAt: { gt: from } } : {}) },
    // The latest 200 (oldest first), or everything new since the last look.
    orderBy: { createdAt: from ? 'asc' : 'desc' }, take: 200,
    select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true, image: true } } },
  })
  if (!from) rows.reverse()
  return rows.map(row => ({ id: row.id, body: row.body, at: row.createdAt.toISOString(), userId: row.user.id, name: row.user.name, image: row.user.image }))
}

export async function sendTripMessage(tripId: string, text: string): Promise<{ error?: string; message?: TripChatMessage }> {
  const userId = await me()
  if (!userId) return { error: 'Please sign in.' }
  const body = typeof text === 'string' ? text.trim() : ''
  if (!body) return { error: 'Write a message first.' }
  if (body.length > LIMIT) return { error: `Keep it under ${LIMIT} characters.` }
  const trip = await prisma.itinerary.findFirst({ where: { id: tripId, ...canEdit(userId) }, select: { userId: true, members: { where: { status: 'joined' }, select: { userId: true } } } })
  if (!trip) return { error: 'This trip is unavailable.' }
  const row = await prisma.tripMessage.create({ data: { itineraryId: tripId, userId, body }, select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true, image: true } } } })
  // Everyone else on the trip who hasn't got an unread chat alert for it yet.
  const others = [...new Set([trip.userId, ...trip.members.map(member => member.userId!)])].filter(id => id && id !== userId)
  const waiting = new Set((await prisma.notification.findMany({ where: { kind: 'trip_chat', itineraryId: tripId, recipientId: { in: others }, readAt: null }, select: { recipientId: true } })).map(row => row.recipientId))
  const fresh = others.filter(id => !waiting.has(id))
  if (fresh.length) {
    const created = await prisma.notification.createManyAndReturn({ data: fresh.map(recipientId => ({ recipientId, actorId: userId, itineraryId: tripId, kind: 'trip_chat', dedupeKey: `trip_chat:${row.id}:${recipientId}` })), skipDuplicates: true, select: { id: true } })
    after(async () => { for (const { id } of created) { try { await deliverNotification(id) } catch { console.error('Trip chat push failed') } } })
  }
  return { message: { id: row.id, body: row.body, at: row.createdAt.toISOString(), userId: row.user.id, name: row.user.name, image: row.user.image } }
}

// Opening a trip's chat: its chat alerts for you are read.
export async function markTripChatRead(tripId: string) {
  const userId = await me()
  if (!userId) return
  await prisma.notification.updateMany({ where: { recipientId: userId, kind: 'trip_chat', itineraryId: tripId, readAt: null }, data: { readAt: new Date() } })
}
