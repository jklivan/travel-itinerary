import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const itineraries = await prisma.itinerary.findMany({
    where: { user: { name: { contains: 'Jennifer', mode: 'insensitive' } } },
    include: {
      destinations: { orderBy: { order: 'asc' }, include: { items: { orderBy: { groupIndex: 'asc' } } } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json(
    itineraries.map((it) => ({
      id: it.id,
      title: it.title,
      visibility: it.visibility,
      createdAt: it.createdAt,
      startDate: it.startDate,
      tags: it.tags,
      destinations: it.destinations.map((d) => ({
        name: d.name,
        country: d.country,
        items: d.items.map((i) => ({ type: i.type, name: i.name, rating: i.rating })),
      })),
    })),
    null, 2
  )
}
