'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { releaseLater } from '@/lib/photoCleanup'

// Profile → Change photo / Remove photo. Only uploads made through the app (an /api/img link) are accepted.
export async function setProfilePhoto(image: string | null) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (image !== null && (typeof image !== 'string' || image.length > 2048 || !image.startsWith('/api/img?url='))) return { error: 'Please choose a photo from your phone.' }
  try {
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } })
    await prisma.user.update({ where: { id: userId }, data: { image } })
    // The old photo's file goes once nothing else uses it.
    if (before?.image !== image) releaseLater([before?.image])
    for (const path of ['/', '/profile', `/user/${userId}`, '/explore', '/saved', '/friends']) revalidatePath(path)
    return { success: true }
  } catch { return { error: 'Could not save your photo. Please try again.' } }
}
