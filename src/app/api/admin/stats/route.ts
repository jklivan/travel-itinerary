import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [totalUsers, usersWithItineraries, totalItineraries, totalPublic, totalSaves, nonPublic] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { itineraries: { some: { visibility: { not: 'draft' } } } } }),
    prisma.itinerary.count(),
    prisma.itinerary.count({ where: { visibility: { not: 'draft' } } }),
    prisma.bucketListItem.count(),
    prisma.itinerary.findMany({
      where: { visibility: { not: 'public' } },
      select: { id: true, title: true, visibility: true, user: { select: { name: true } } },
    }),
  ])

  return Response.json({
    users: { total: totalUsers, withPublicItineraries: usersWithItineraries },
    itineraries: { total: totalItineraries, public: totalPublic },
    totalSaves,
    nonPublic,
  })
}
