import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTags } from '@/lib/generateTags'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const itineraries = await prisma.itinerary.findMany({
    where: { tags: { equals: [] } },
    include: {
      destinations: { orderBy: { order: 'asc' }, include: { items: true } },
    },
  })

  let tagged = 0
  let skipped = 0

  for (const it of itineraries) {
    const destSummary = it.destinations.map(d => `${d.name} (${d.items.length} items)`).join(', ')
    console.log(`[backfill-tags] processing: "${it.title}" | dests: ${destSummary || 'none'}`)
    const tags = await generateTags(it.title, it.destinations, it.audience)
    if (tags.length > 0) {
      await prisma.itinerary.update({ where: { id: it.id }, data: { tags } })
      console.log(`[backfill-tags] tagged: "${it.title}" → ${tags.join(', ')}`)
      tagged++
    } else {
      console.log(`[backfill-tags] skipped: "${it.title}" — no tags generated`)
      skipped++
    }
  }

  return Response.json({ tagged, skipped, total: itineraries.length })
}
