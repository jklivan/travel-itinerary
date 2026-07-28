import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.ADMIN_SECRET)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { count } = await prisma.itinerary.updateMany({ where: { budget: 5 }, data: { budget: 4 } })
  return Response.json({ fixed: count })
}
