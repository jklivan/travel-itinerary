import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const it = await prisma.itinerary.findUnique({ where: { id }, select: { id: true, title: true } })
  if (!it) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.itinerary.delete({ where: { id } })
  return Response.json({ deleted: true, title: it.title })
}
