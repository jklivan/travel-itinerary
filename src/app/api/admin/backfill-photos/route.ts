import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchStockPhoto } from '@/lib/stockPhoto'

export async function POST(req: NextRequest) {
  // Simple secret check so random people can't trigger this
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all itineraries with no photos at all
  const itineraries = await prisma.itinerary.findMany({
    where: { photos: { none: {} } },
    include: {
      destinations: { orderBy: { order: 'asc' }, take: 1 },
    },
  })

  let filled = 0
  let skipped = 0

  for (const it of itineraries) {
    const dest = it.destinations[0]
    if (!dest) { skipped++; continue }

    const query = `${dest.name}${dest.country ? ` ${dest.country}` : ''} travel`
    const url = await fetchStockPhoto(query)

    if (url) {
      await prisma.photo.create({
        data: { url, isStock: true, itineraryId: it.id },
      })
      filled++
    } else {
      skipped++
    }
  }

  return Response.json({ filled, skipped, total: itineraries.length })
}
