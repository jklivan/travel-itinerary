'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createTripNotification } from '@/lib/notifications'
import { deliverNotification } from '@/lib/push'

export async function addToBucketList(itineraryId: string, folderId?: string | null) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not logged in' }

  const itinerary = await prisma.itinerary.findUnique({ where: { id: itineraryId }, select: { userId: true, visibility: true } })
  if (!itinerary || itinerary.visibility === 'draft') return { error: 'Trip not found' }
  const actorId = session.user.id
  const result = await prisma.$transaction(async tx => {
    if (folderId !== undefined && folderId !== null) {
      if (typeof folderId !== 'string' || !folderId || !await tx.savedFolder.findFirst({ where: { id: folderId, userId: actorId } })) {
        return { error: 'Folder not found. Please choose another folder.' }
      }
    }
    const saved = await tx.bucketListItem.createMany({ data: [{ userId: actorId, itineraryId, folderId }], skipDuplicates: true })
    if (folderId !== undefined) {
      await tx.bucketListItem.update({ where: { userId_itineraryId: { userId: actorId, itineraryId } }, data: { folderId } })
    }
    const notificationId = saved.count
      ? await createTripNotification(tx, { recipientId: itinerary.userId, actorId, itineraryId, kind: 'save' })
      : null
    return { notificationId }
  })
  if (result.error) return { error: result.error }
  const notificationId = result.notificationId
  if (notificationId) after(async () => {
    try { await deliverNotification(notificationId) } catch { console.error('Save push delivery failed') }
  })
  revalidatePath(`/itinerary/${itineraryId}`)
  revalidatePath(`/user/${session.user.id}`)
  revalidatePath('/saved')
}

export async function removeFromBucketList(itineraryId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not logged in' }

  await prisma.bucketListItem.deleteMany({
    where: { userId: session.user.id, itineraryId },
  })
  revalidatePath(`/itinerary/${itineraryId}`)
  revalidatePath(`/user/${session.user.id}`)
  revalidatePath('/saved')
}
