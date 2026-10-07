'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createTripNotification } from '@/lib/notifications'
import { deliverNotification } from '@/lib/push'

// The feed's likes sheet: everyone who liked a trip, newest first, and whether you follow each of them.
// Anyone who can open the trip can see this: any posted trip, or your own draft.
export async function loadLikers(itineraryId: string) {
  const userId = (await auth())?.user?.id
  if (typeof itineraryId !== 'string' || itineraryId.length > 200) return { error: 'Not found.', likers: [], userId }
  const itinerary = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { visibility: true, userId: true } })
  if (!itinerary || (itinerary.visibility === 'draft' && itinerary.userId !== userId)) return { error: 'Not found.', likers: [], userId }
  const likes = await prisma.tripLike.findMany({ where: { itineraryId }, orderBy: { createdAt: 'desc' }, take: 500, select: { user: { select: { id: true, name: true, image: true } } } })
  const following = userId ? new Set((await prisma.follow.findMany({ where: { followerId: userId, status: 'accepted', followingId: { in: likes.map(like => like.user.id) } }, select: { followingId: true } })).map(row => row.followingId)) : new Set<string>()
  return { userId, likers: likes.map(({ user }) => ({ ...user, following: following.has(user.id) })) }
}


// The heart: like or unlike a posted trip. Separate from saving it to a folder.
export async function setTripLike(itineraryId: string, liked: boolean) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to like trips.' }
  if (typeof itineraryId !== 'string' || itineraryId.length > 200 || typeof liked !== 'boolean') return { error: 'Trip not found' }
  const trip = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { userId: true, visibility: true } })
  if (!trip || trip.visibility === 'draft') return { error: 'Trip not found' }
  let notificationId: string | null = null
  if (liked) {
    notificationId = await prisma.$transaction(async tx => {
      const created = await tx.tripLike.createMany({ data: [{ userId, itineraryId }], skipDuplicates: true })
      return created.count ? createTripNotification(tx, { recipientId: trip.userId, actorId: userId, itineraryId, kind: 'like' }) : null
    })
  } else await prisma.tripLike.deleteMany({ where: { userId, itineraryId } })
  if (notificationId) { const id = notificationId; after(async () => { try { await deliverNotification(id) } catch { console.error('Like push delivery failed') } }) }
  revalidatePath(`/itinerary/${itineraryId}`)
  return { count: await prisma.tripLike.count({ where: { itineraryId } }) }
}
