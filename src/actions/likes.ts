'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// The feed's likes sheet: everyone who liked (saved) a trip, newest first, and whether you follow each of them.
// Anyone who can open the trip can see this: any posted trip, or your own draft.
export async function loadLikers(itineraryId: string) {
  const userId = (await auth())?.user?.id
  if (typeof itineraryId !== 'string' || itineraryId.length > 200) return { error: 'Not found.', likers: [], userId }
  const itinerary = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { visibility: true, userId: true } })
  if (!itinerary || (itinerary.visibility === 'draft' && itinerary.userId !== userId)) return { error: 'Not found.', likers: [], userId }
  const likes = await prisma.bucketListItem.findMany({ where: { itineraryId }, orderBy: { createdAt: 'desc' }, take: 500, select: { user: { select: { id: true, name: true, image: true } } } })
  const following = userId ? new Set((await prisma.follow.findMany({ where: { followerId: userId, status: 'accepted', followingId: { in: likes.map(like => like.user.id) } }, select: { followingId: true } })).map(row => row.followingId)) : new Set<string>()
  return { userId, likers: likes.map(({ user }) => ({ ...user, following: following.has(user.id) })) }
}
