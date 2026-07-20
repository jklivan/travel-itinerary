'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function addToBucketList(itineraryId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not logged in' }

  await prisma.bucketListItem.create({
    data: { userId: session.user.id, itineraryId },
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
