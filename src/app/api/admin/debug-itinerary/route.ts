import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const it = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      destinations: {
        include: { items: true },
      },
    },
  })

  if (!it) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({
    id: it.id,
    title: it.title,
    destinations: it.destinations.map(d => ({
      id: d.id,
      name: d.name,
      lat: d.lat,
      lng: d.lng,
      itemCount: d.items.length,
      items: d.items.map(i => ({ id: i.id, type: i.type, name: i.name })),
    })),
  })
}
