'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { canEdit } from '@/lib/tripAccess'

// Photos added to a trip but not yet tapped into a place (Add your trip photos): kept as the trip's own photos, so
// they're still there after closing the sorter, adding places first, or coming back another day. Tapping one into
// a place takes it off the pile (it then lives on the place).

const usable = (urls: unknown): string[] | null => Array.isArray(urls) && urls.length <= 200
  && urls.every(url => typeof url === 'string' && url.length <= 4096 && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url))) ? [...new Set(urls as string[])] : null

async function editableTrip(tripId: string) {
  const userId = (await auth())?.user?.id
  if (!userId || typeof tripId !== 'string') return null
  return prisma.itinerary.findFirst({ where: { id: tripId, ...canEdit(userId) }, select: { id: true } })
}

export async function addToPhotoPile(tripId: string, urls: string[]): Promise<{ error?: string }> {
  const list = usable(urls)
  if (!list) return { error: 'Invalid photos.' }
  if (!await editableTrip(tripId)) return { error: 'This trip is unavailable.' }
  const existing = new Set((await prisma.photo.findMany({ where: { itineraryId: tripId, url: { in: list } }, select: { url: true } })).map(photo => photo.url))
  const fresh = list.filter(url => !existing.has(url))
  if (fresh.length) await prisma.photo.createMany({ data: fresh.map(url => ({ itineraryId: tripId, url })) })
  revalidatePath(`/plan/${tripId}`)
  return {}
}

export async function takeFromPhotoPile(tripId: string, urls: string[]): Promise<{ error?: string }> {
  const list = usable(urls)
  if (!list) return { error: 'Invalid photos.' }
  if (!await editableTrip(tripId)) return { error: 'This trip is unavailable.' }
  await prisma.photo.deleteMany({ where: { itineraryId: tripId, url: { in: list }, isStock: false } })
  revalidatePath(`/plan/${tripId}`)
  return {}
}
