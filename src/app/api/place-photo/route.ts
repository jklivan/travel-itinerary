import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { findPlacePhoto } from '@/lib/placePhoto'
import { eventPhotos } from '@/lib/eventPhotos'

export async function GET(request: NextRequest) {
  const reply = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API
  const id = request.nextUrl.searchParams.get('item')
  // ?fallback=1: the place's saved photo failed to load (e.g. an expired provider link), so look it up anyway.
  const fallback = request.nextUrl.searchParams.get('fallback') === '1'
  if (!apiKey || !id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return reply(null)
  const item = await prisma.destItem.findUnique({ where: { id }, include: { destination: { include: { itinerary: { select: { visibility: true, userId: true } } } } } })
  if (!item || (eventPhotos(item.photoUrls, item.photoUrl).length && !fallback)) return reply(null)
  const viewerId = (await auth())?.user?.id
  const isOwner = viewerId === item.destination.itinerary.userId
  if (item.destination.itinerary.visibility !== 'public' && !isOwner) return reply(null)
  // In your own trip, a place with no Google ID gets a looser match, and the ID it finds is saved so the
  // photo, map pin and Google Maps link keep working. Other people's places keep the strict match.
  const loose = isOwner && !item.placeId
  const photo = await findPlacePhoto({ name: item.name, placeId: item.placeId, city: item.destination.name, country: item.destination.country, loose }, apiKey)
  if (photo && loose) await prisma.destItem.updateMany({ where: { id: item.id, placeId: null }, data: { placeId: photo.placeId } }).catch(() => {})
  return reply(photo)
}
