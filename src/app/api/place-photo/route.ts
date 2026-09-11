import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { findPlacePhoto } from '@/lib/placePhoto'
import { eventPhotos } from '@/lib/eventPhotos'

export async function GET(request: NextRequest) {
  const reply = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API
  const id = request.nextUrl.searchParams.get('item')
  if (!apiKey || !id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return reply(null)
  const item = await prisma.destItem.findUnique({ where: { id }, include: { destination: { include: { itinerary: { select: { visibility: true, userId: true } } } } } })
  if (!item || eventPhotos(item.photoUrls, item.photoUrl).length) return reply(null)
  if (item.destination.itinerary.visibility !== 'public') {
    const session = await auth()
    if (session?.user?.id !== item.destination.itinerary.userId) return reply(null)
  }
  return reply(await findPlacePhoto({ name: item.name, placeId: item.placeId, city: item.destination.name, country: item.destination.country }, apiKey))
}
