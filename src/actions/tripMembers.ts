'use server'

import { randomBytes } from 'node:crypto'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { deliverNotification } from '@/lib/push'

// Group trips (#116): the creator invites friends (or shares a link); people join, decline or leave; the creator can
// remove anyone. Joined members can change the plan (lib/tripAccess).

type Result = { error?: string; success?: boolean; link?: string; tripId?: string }
const me = async () => (await auth())?.user?.id ?? null
const unavailable = 'This trip is unavailable.'

function refresh(tripId: string) {
  for (const path of [`/plan/${tripId}`, '/plan', '/trips']) revalidatePath(path)
}

// Notifies someone about the trip (an invite to them, or someone joining for the creator), with a phone alert.
async function notify(recipientId: string, actorId: string, itineraryId: string, kind: 'trip_invite' | 'trip_joined') {
  if (recipientId === actorId) return
  const rows = await prisma.notification.createManyAndReturn({ data: [{ recipientId, actorId, itineraryId, kind, dedupeKey: `${kind}:${itineraryId}:${actorId}:${recipientId}` }], skipDuplicates: true })
  const id = rows[0]?.id
  if (id) after(async () => { try { await deliverNotification(id) } catch { console.error('Trip invite push failed') } })
}

// Friends the creator can invite: people they follow or who follow them, not already on the trip.
export async function friendsToInvite(tripId: string) {
  const userId = await me()
  if (!userId) return []
  const trip = await prisma.itinerary.findFirst({ where: { id: tripId, userId }, select: { members: { where: { userId: { not: null }, status: { in: ['invited', 'joined'] } }, select: { userId: true } } } })
  if (!trip) return []
  const taken = new Set([userId, ...trip.members.map(member => member.userId!)])
  const follows = await prisma.follow.findMany({ where: { status: 'accepted', OR: [{ followerId: userId }, { followingId: userId }] }, select: { follower: { select: { id: true, name: true, image: true } }, following: { select: { id: true, name: true, image: true } } } })
  const people = new Map<string, { id: string; name: string; image: string | null }>()
  for (const follow of follows) for (const person of [follow.follower, follow.following]) if (!taken.has(person.id)) people.set(person.id, person)
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function inviteFriend(tripId: string, friendId: string): Promise<Result> {
  const userId = await me()
  if (!userId) return { error: 'Please sign in.' }
  const trip = await prisma.itinerary.findFirst({ where: { id: tripId, userId }, select: { id: true } })
  if (!trip) return { error: 'Only the person who started this trip can invite people.' }
  const friend = await prisma.follow.findFirst({ where: { status: 'accepted', OR: [{ followerId: userId, followingId: friendId }, { followerId: friendId, followingId: userId }] }, select: { id: true } })
  if (!friend) return { error: 'You can invite people you follow or who follow you.' }
  const current = await prisma.tripMember.findUnique({ where: { itineraryId_userId: { itineraryId: tripId, userId: friendId } }, select: { status: true } })
  if (current?.status === 'joined') return { success: true }
  // Invited again after declining: a fresh invite.
  await prisma.tripMember.upsert({
    where: { itineraryId_userId: { itineraryId: tripId, userId: friendId } },
    create: { itineraryId: tripId, userId: friendId, invitedById: userId, status: 'invited' },
    update: { invitedById: userId, status: 'invited' },
  })
  await notify(friendId, userId, tripId, 'trip_invite')
  refresh(tripId)
  return { success: true }
}

// A link anyone can open to join (one per trip, made the first time it's asked for).
export async function inviteLink(tripId: string): Promise<Result> {
  const userId = await me()
  if (!userId) return { error: 'Please sign in.' }
  const trip = await prisma.itinerary.findFirst({ where: { id: tripId, userId }, select: { id: true } })
  if (!trip) return { error: 'Only the person who started this trip can invite people.' }
  const existing = await prisma.tripMember.findFirst({ where: { itineraryId: tripId, userId: null, token: { not: null } }, select: { token: true } })
  const token = existing?.token ?? (await prisma.tripMember.create({ data: { itineraryId: tripId, invitedById: userId, token: randomBytes(12).toString('base64url') }, select: { token: true } })).token
  return { success: true, link: `/join/${token}` }
}

// Join or decline: an invite to you (by trip), or a link (by its code).
export async function answerInvite(code: string, join: boolean): Promise<Result> {
  const userId = await me()
  if (!userId) return { error: 'Please sign in.' }
  const link = await prisma.tripMember.findFirst({ where: { token: code, userId: null }, select: { itineraryId: true, invitedById: true } })
  const tripId = link?.itineraryId ?? code
  const trip = await prisma.itinerary.findUnique({ where: { id: tripId }, select: { id: true, userId: true } })
  if (!trip) return { error: unavailable }
  if (trip.userId === userId) return { success: true, tripId }
  if (link) {
    if (!join) return { success: true }
    await prisma.tripMember.upsert({
      where: { itineraryId_userId: { itineraryId: tripId, userId } },
      create: { itineraryId: tripId, userId, invitedById: link.invitedById, status: 'joined', joinedAt: new Date() },
      update: { status: 'joined', joinedAt: new Date() },
    })
  } else {
    const updated = await prisma.tripMember.updateMany({ where: { itineraryId: tripId, userId, status: { in: ['invited', 'joined'] } }, data: join ? { status: 'joined', joinedAt: new Date() } : { status: 'declined' } })
    if (!updated.count) return { error: 'This invitation is no longer open.' }
  }
  if (join) await notify(trip.userId, userId, tripId, 'trip_joined')
  refresh(tripId)
  return { success: true, tripId }
}

// The creator removes someone, or someone leaves.
export async function removeMember(tripId: string, memberId: string): Promise<Result> {
  const userId = await me()
  if (!userId) return { error: 'Please sign in.' }
  const trip = await prisma.itinerary.findUnique({ where: { id: tripId }, select: { userId: true } })
  if (!trip || (trip.userId !== userId && memberId !== userId)) return { error: unavailable }
  await prisma.tripMember.deleteMany({ where: { itineraryId: tripId, userId: memberId } })
  refresh(tripId)
  return { success: true }
}
