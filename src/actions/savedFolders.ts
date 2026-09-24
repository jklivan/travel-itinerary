'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getSavedFolders(itineraryId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in to organize saved trips.' }
  const userId = session.user.id
  const [folders, saved] = await Promise.all([
    prisma.savedFolder.findMany({ where: { userId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.bucketListItem.findUnique({ where: { userId_itineraryId: { userId, itineraryId } }, select: { folderId: true } }),
  ])
  return { folders, folderId: saved?.folderId ?? null }
}

export async function saveFolder(name: string, folderId?: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in to organize saved trips.' }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) return { error: 'Enter a folder name between 1 and 80 characters.' }
  if (folderId !== undefined && (typeof folderId !== 'string' || !folderId)) return { error: 'Folder not found.' }
  const userId = session.user.id
  try {
    const folder = folderId
      ? await prisma.savedFolder.update({ where: { id: folderId, userId }, data: { name: name.trim() }, select: { id: true, name: true } })
      : await prisma.savedFolder.create({ data: { userId, name: name.trim() }, select: { id: true, name: true } })
    revalidatePath(`/user/${userId}`)
    revalidatePath('/saved')
    return { folder }
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return { error: 'You already have a folder with that name.' }
    return { error: 'Could not save this folder. Please try again.' }
  }
}

export async function deleteSavedFolder(folderId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in to organize saved trips.' }
  if (typeof folderId !== 'string' || !folderId) return { error: 'Folder not found.' }
  await prisma.savedFolder.deleteMany({ where: { id: folderId, userId: session.user.id } })
  revalidatePath(`/user/${session.user.id}`)
  revalidatePath('/saved')
  return { success: true }
}
