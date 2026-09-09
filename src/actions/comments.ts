'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createTripNotification } from '@/lib/notifications'
import { deliverNotification } from '@/lib/push'

export async function addComment(itineraryId: string, content: string, parentId?: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in to comment.' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'Comment cannot be empty.' }
  if (trimmed.length > 1000) return { error: 'Comment is too long.' }

  const itinerary = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { visibility: true, userId: true } })
  if (!itinerary || itinerary.visibility === 'draft') return { error: 'Not found.' }

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { itineraryId: true, parentId: true } })
    if (!parent || parent.itineraryId !== itineraryId || parent.parentId !== null) return { error: 'Invalid reply target.' }
  }

  const actorId = session.user.id
  const notificationId = await prisma.$transaction(async tx => {
    const comment = await tx.comment.create({ data: { content: trimmed, userId: actorId, itineraryId, parentId: parentId ?? null } })
    return createTripNotification(tx, { recipientId: itinerary.userId, actorId, itineraryId, kind: 'comment', commentId: comment.id })
  })
  if (notificationId) after(async () => {
    try { await deliverNotification(notificationId) } catch { console.error('Comment push delivery failed') }
  })

  revalidatePath(`/itinerary/${itineraryId}`)
  return {}
}

export async function deleteComment(commentId: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in.' }

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, itineraryId: true } })
  if (!comment || comment.userId !== session.user.id) return { error: 'Not found.' }

  await prisma.comment.delete({ where: { id: commentId } })
  revalidatePath(`/itinerary/${comment.itineraryId}`)
  return {}
}
