import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geocode } from '@/lib/geocode'

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = await prisma.destItem.findMany({
    where: { lat: null, name: { not: '' } },
    select: {
      id: true,
      name: true,
      type: true,
      destination: { select: { name: true, country: true } },
    },
  })

  console.log(`[backfill-item-coords] ${items.length} items to geocode`)

  let geocoded = 0
  let failed = 0

  for (const item of items) {
    const query = [item.name, item.destination.name, item.destination.country].filter(Boolean).join(', ')
    const coords = await geocode(query)
    if (coords) {
      await prisma.destItem.update({ where: { id: item.id }, data: coords })
      console.log(`[backfill-item-coords] ✓ "${query}" → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
      geocoded++
    } else {
      console.log(`[backfill-item-coords] ✗ "${query}" — no result`)
      failed++
    }
    // Nominatim rate limit: 1 req/sec
    await sleep(1100)
  }

  return Response.json({ geocoded, failed, total: items.length })
}
