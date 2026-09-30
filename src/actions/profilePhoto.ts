'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// Profile → Change photo / Remove photo. Only uploads made through the app (an /api/img link) are accepted.
export async function setProfilePhoto(image: string | null) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (image !== null && (typeof image !== 'string' || image.length > 2048 || !image.startsWith('/api/img?url='))) return { error: 'Please choose a photo from your phone.' }
  try {
    await prisma.user.update({ where: { id: userId }, data: { image } })
    for (const path of ['/', '/profile', `/user/${userId}`, '/explore', '/saved', '/friends']) revalidatePath(path)
    return { success: true }
  } catch { return { error: 'Could not save your photo. Please try again.' } }
}
