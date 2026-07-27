import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geocode } from '@/lib/geocode'

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dests = await prisma.destination.findMany({
    where: { lat: null },
    select: { id: true, name: true, country: true },
  })

  console.log(`[backfill-coords] ${dests.length} destinations to geocode`)

  let geocoded = 0
  let failed = 0

  for (const dest of dests) {
    const query = `${dest.name}${dest.country ? `, ${dest.country}` : ''}`
    const coords = await geocode(query)
    if (coords) {
      await prisma.destination.update({ where: { id: dest.id }, data: coords })
      console.log(`[backfill-coords] ✓ "${query}" → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
      geocoded++
    } else {
      console.log(`[backfill-coords] ✗ "${query}" — no result`)
      failed++
    }
    // Nominatim rate limit: 1 req/sec
    await sleep(1100)
  }

  return Response.json({ geocoded, failed, total: dests.length })
}
