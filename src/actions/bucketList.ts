'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createTripNotification } from '@/lib/notifications'
import { deliverNotification } from '@/lib/push'

export async function addToBucketList(itineraryId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not logged in' }

  const itinerary = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { userId: true, visibility: true } })
  if (!itinerary || itinerary.visibility === 'draft') return { error: 'Trip not found' }
  const actorId = session.user.id
  const notificationId = await prisma.$transaction(async tx => {
    const saved = await tx.bucketListItem.createMany({ data: [{ userId: actorId, itineraryId }], skipDuplicates: true })
    if (!saved.count) return null
    return createTripNotification(tx, { recipientId: itinerary.userId, actorId, itineraryId, kind: 'save' })
  })
  if (notificationId) after(async () => {
    try { await deliverNotification(notificationId) } catch { console.error('Save push delivery failed') }
  })
  revalidatePath(`/itinerary/${itineraryId}`)
  revalidatePath(`/user/${session.user.id}`)
}

export async function removeFromBucketList(itineraryId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not logged in' }

  await prisma.bucketListItem.deleteMany({
    where: { userId: session.user.id, itineraryId },
  })
  revalidatePath(`/itinerary/${itineraryId}`)
  revalidatePath(`/user/${session.user.id}`)
}
