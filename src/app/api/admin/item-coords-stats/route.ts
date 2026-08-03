import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [total, withCoords, missing] = await Promise.all([
    prisma.destItem.count(),
    prisma.destItem.count({ where: { lat: { not: null } } }),
    prisma.destItem.groupBy({
      by: ['type'],
      where: { lat: null, name: { not: '' } },
      _count: { _all: true },
    }),
  ])

  return Response.json({ total, withCoords, missingByType: missing.map(m => ({ type: m.type, count: m._count._all })) })
}
