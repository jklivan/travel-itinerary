import type { Prisma } from '@/generated/prisma/client'

export async function createTripNotification(tx: Prisma.TransactionClient, input: {
  recipientId: string; actorId: string; itineraryId: string; kind: 'comment' | 'save' | 'like'; commentId?: string
}) {
  if (input.recipientId === input.actorId) return null
  const dedupeKey = input.kind === 'comment' ? `comment:${input.commentId}` : `save:${input.actorId}:${input.itineraryId}`
  // A saved trip can be removed and saved again without spamming its owner.
  const rows = await tx.notification.createManyAndReturn({ data: [{ ...input, dedupeKey }], skipDuplicates: true })
  return rows[0]?.id ?? null
}

// Someone started following you. One per follower, so unfollowing and following again doesn't notify twice.
export async function createFollowNotification(tx: Prisma.TransactionClient, followerId: string, followingId: string) {
  if (followerId === followingId) return null
  const rows = await tx.notification.createManyAndReturn({ data: [{ recipientId: followingId, actorId: followerId, kind: 'follow', dedupeKey: `follow:${followerId}:${followingId}` }], skipDuplicates: true, select: { id: true } })
  return rows[0]?.id ?? null
}

// Called only on creation or a draft-to-public transition, never an ordinary edit.
export async function createPublishedTripNotifications(tx: Prisma.TransactionClient, itineraryId: string) {
  const itinerary = await tx.itinerary.findUnique({ where: { id: itineraryId }, select: { userId: true, visibility: true } })
  if (!itinerary || itinerary.visibility !== 'public') return []
  const followers = await tx.follow.findMany({
    where: { followingId: itinerary.userId, status: 'accepted', followerId: { not: itinerary.userId } },
    select: { followerId: true },
  })
  if (!followers.length) return []
  return tx.notification.createManyAndReturn({
    data: followers.map(({ followerId }) => ({
      recipientId: followerId, actorId: itinerary.userId, itineraryId, kind: 'published',
      dedupeKey: `published:${itineraryId}:${followerId}`,
    })),
    skipDuplicates: true,
    select: { id: true },
  })
}

// Someone (anyone, not just a friend) posted a trip to a place you're planning to go: like a new-listing alert, so
// Postcard comes to mind between trips. For upcoming private plans (yours, or one you joined) with a stop of the same
// name (and country, when both say). Not for the poster, their followers (they already hear about it: 'published'),
// or anyone blocked either way, and at most two a day each so it stays worth reading.
const PLANNED_PER_DAY = 2
export async function createPlannedDestinationNotifications(tx: Prisma.TransactionClient, itineraryId: string) {
  const trip = await tx.itinerary.findUnique({ where: { id: itineraryId }, select: { userId: true, visibility: true, destinations: { select: { name: true, country: true } } } })
  if (!trip || trip.visibility !== 'public') return []
  const stops = trip.destinations.filter(stop => stop.name.trim() && stop.name !== 'Destination to decide')
  if (!stops.length) return []
  const today = new Date(new Date().toISOString().slice(0, 10))
  const plans = await tx.itinerary.findMany({
    where: {
      visibility: 'draft', id: { not: itineraryId }, OR: [{ datesFlexible: true }, { endDate: { gte: today } }],
      destinations: { some: { OR: stops.map(stop => ({ name: { equals: stop.name.trim(), mode: 'insensitive' as const }, ...(stop.country ? { OR: [{ country: null }, { country: { equals: stop.country, mode: 'insensitive' as const } }] } : {}) })) } },
    },
    select: { userId: true, members: { where: { status: 'joined', userId: { not: null } }, select: { userId: true } } },
  })
  const planners = new Set(plans.flatMap(plan => [plan.userId, ...plan.members.map(member => member.userId!)]))
  planners.delete(trip.userId)
  if (!planners.size) return []
  const [followers, blocks, recent] = await Promise.all([
    tx.follow.findMany({ where: { followingId: trip.userId, status: 'accepted' }, select: { followerId: true } }),
    tx.block.findMany({ where: { OR: [{ blockerId: trip.userId }, { blockedId: trip.userId }] }, select: { blockerId: true, blockedId: true } }),
    tx.notification.groupBy({ by: ['recipientId'], where: { kind: 'planned_destination', recipientId: { in: [...planners] }, createdAt: { gte: new Date(Date.now() - 86_400_000) } }, _count: true }),
  ])
  for (const { followerId } of followers) planners.delete(followerId)
  for (const block of blocks) { planners.delete(block.blockerId); planners.delete(block.blockedId) }
  for (const row of recent) if (row._count >= PLANNED_PER_DAY) planners.delete(row.recipientId)
  if (!planners.size) return []
  return tx.notification.createManyAndReturn({
    data: [...planners].map(recipientId => ({ recipientId, actorId: trip.userId, itineraryId, kind: 'planned_destination', dedupeKey: `planned_destination:${itineraryId}:${recipientId}` })),
    skipDuplicates: true, select: { id: true },
  })
}

// Forum visibility is chosen by the author: people they follow can read it.
export async function createForumNotifications(tx: Prisma.TransactionClient, questionId: string, authorId: string) {
  const friends = await tx.follow.findMany({ where: { followerId: authorId, status: 'accepted', followingId: { not: authorId } }, select: { followingId: true } })
  if (!friends.length) return []
  return tx.notification.createManyAndReturn({
    data: friends.map(friend => ({ recipientId: friend.followingId, actorId: authorId, questionId, kind: 'forum', dedupeKey: `forum:${questionId}:${friend.followingId}` })),
    skipDuplicates: true, select: { id: true },
  })
}
