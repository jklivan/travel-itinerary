'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { eventPhotos } from '@/lib/eventPhotos'
import { revalidatePath } from 'next/cache'

type Edit = { kind: 'rating'; rating: number } | { kind: 'photos'; photos: string[]; expectedPhotos: string[] }

export async function updatePlace(itemId: string, edit: Edit) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in to edit your trip.' }
  if (typeof itemId !== 'string' || !itemId || !edit || typeof edit !== 'object') return { error: 'Invalid place update.' }
  if (edit.kind === 'rating') {
    if (!Number.isInteger(edit.rating) || edit.rating < 0 || edit.rating > 5) return { error: 'Choose a rating from 1 to 5, or clear the rating.' }
  } else if (edit.kind === 'photos') {
    if (!Array.isArray(edit.photos) || !Array.isArray(edit.expectedPhotos)
      || ![...edit.photos, ...edit.expectedPhotos].every(url => typeof url === 'string' && url.length <= 4096 && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)))) {
      return { error: 'Invalid photo update.' }
    }
  } else return { error: 'Invalid place update.' }
  try {
    const owned = { id: itemId, destination: { itinerary: { userId: session.user.id } } }
    const item = await prisma.destItem.findFirst({ where: owned, select: { photoUrl: true, photoUrls: true, destination: { select: { itineraryId: true } } } })
    if (!item) return { error: 'This place is unavailable or you don’t own this trip.' }
    if (edit.kind === 'photos' && JSON.stringify(eventPhotos(item.photoUrls, item.photoUrl)) !== JSON.stringify(eventPhotos(edit.expectedPhotos))) {
      return { error: 'Photos changed elsewhere. Cancel and reopen the photo editor to load the latest photos.' }
    }
    const photos = edit.kind === 'photos' ? eventPhotos(edit.photos) : []
    const result = await prisma.destItem.updateMany({
      where: { ...owned, ...(edit.kind === 'photos' ? { photoUrls: { equals: item.photoUrls }, photoUrl: item.photoUrl } : {}) },
      data: edit.kind === 'rating' ? { rating: edit.rating || null } : { photoUrls: photos, photoUrl: photos[0] ?? null },
    })
    if (result.count !== 1) return { error: 'This place changed while saving. Reload and try again.' }
    revalidatePath(`/plan/${item.destination.itineraryId}`)
    revalidatePath(`/itinerary/${item.destination.itineraryId}`)
    revalidatePath(`/user/${session.user.id}`)
    revalidatePath('/')
    revalidatePath('/explore')
    return { success: true }
  } catch {
    return { error: 'Could not save. Your changes are still here; please try again.' }
  }
}
