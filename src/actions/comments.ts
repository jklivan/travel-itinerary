'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function addComment(itineraryId: string, content: string, parentId?: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'You must be logged in to comment.' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'Comment cannot be empty.' }
  if (trimmed.length > 1000) return { error: 'Comment is too long.' }

  const itinerary = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { visibility: true } })
  if (!itinerary || itinerary.visibility === 'draft') return { error: 'Not found.' }

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { itineraryId: true, parentId: true } })
    if (!parent || parent.itineraryId !== itineraryId || parent.parentId !== null) return { error: 'Invalid reply target.' }
  }

  await prisma.comment.create({
    data: { content: trimmed, userId: session.user.id, itineraryId, parentId: parentId ?? null },
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
