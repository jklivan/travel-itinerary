import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { fetchStockPhoto } from '@/lib/stockPhoto'

// A trip card with no photos at all (none of its own, and no place photo found): a stock photo of the trip's
// destination, saved to the trip the first time so it's the cover from then on. Only for posted trips (or your own).
export async function GET(request: NextRequest) {
  const reply = (url: string | null) => Response.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } })
  const id = request.nextUrl.searchParams.get('trip')
  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return reply(null)
  const trip = await prisma.itinerary.findUnique({ where: { id }, select: { userId: true, visibility: true, photos: { orderBy: { isStock: 'desc' }, take: 1, select: { url: true, isStock: true } }, destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true } } } })
  if (!trip) return reply(null)
  if (trip.visibility === 'draft' && trip.userId !== (await auth())?.user?.id) return reply(null)
  if (trip.photos[0]?.isStock) return reply(trip.photos[0].url)
  // A trip with photos of its own shows those; nothing to add.
  if (trip.photos.length) return reply(null)
  const destination = trip.destinations.find(d => d.name !== 'Destination to decide')
  if (!destination) return reply(null)
  const url = await fetchStockPhoto(`${destination.name}${destination.country ? ` ${destination.country}` : ''} travel`)
  // Saved only if the trip still has no photos (two viewers at once add just one).
  if (url) await prisma.$transaction(async tx => { if (!await tx.photo.count({ where: { itineraryId: id } })) await tx.photo.create({ data: { url, isStock: true, itineraryId: id } }) })
  return reply(url)
}
