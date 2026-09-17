'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function keepTripPrivate(id: string): Promise<{ error?: string; success?: boolean }> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to manage your trip.' }
  const result = await prisma.itinerary.updateMany({ where: { id, userId }, data: { visibility: 'draft' } })
  if (!result.count) return { error: 'This trip is unavailable or belongs to another account.' }
  for (const path of ['/', '/explore', '/plan', `/plan/${id}`, `/itinerary/${id}`, `/user/${userId}`, '/notifications']) revalidatePath(path)
  return { success: true }
}
