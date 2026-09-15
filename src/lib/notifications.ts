import type { Prisma } from '@/generated/prisma/client'

export async function createTripNotification(tx: Prisma.TransactionClient, input: {
  recipientId: string; actorId: string; itineraryId: string; kind: 'comment' | 'save'; commentId?: string
}) {
  if (input.recipientId === input.actorId) return null
  const dedupeKey = input.kind === 'comment' ? `comment:${input.commentId}` : `save:${input.actorId}:${input.itineraryId}`
  // A saved trip can be removed and saved again without spamming its owner.
  const rows = await tx.notification.createManyAndReturn({ data: [{ ...input, dedupeKey }], skipDuplicates: true })
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
