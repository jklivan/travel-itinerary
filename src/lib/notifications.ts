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
