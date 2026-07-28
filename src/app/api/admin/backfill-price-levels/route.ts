import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE:    1,
  PRICE_LEVEL_MODERATE:       2,
  PRICE_LEVEL_EXPENSIVE:      3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

async function searchPlacePrice(name: string, context: string): Promise<number | null> {
  if (!API_KEY) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.priceLevel',
      },
      body: JSON.stringify({ textQuery: `${name} ${context}`.trim(), pageSize: 1 }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as { places?: { priceLevel?: string }[] }
    const place = data.places?.[0]
    if (!place?.priceLevel) return null
    return PRICE_LEVEL_MAP[place.priceLevel] ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = await prisma.destItem.findMany({
    where: { type: { in: ['hotel', 'food_drink'] }, priceLevel: null, name: { not: '' } },
    include: { destination: { select: { name: true, country: true } } },
  })

  console.log(`[backfill-price-levels] ${items.length} items to process`)

  let updated = 0
  let skipped = 0
  const results: string[] = []

  for (const item of items) {
    const context = [item.destination.name, item.destination.country].filter(Boolean).join(', ')
    const priceLevel = await searchPlacePrice(item.name, context)

    if (priceLevel !== null) {
      await prisma.destItem.update({ where: { id: item.id }, data: { priceLevel } })
      const msg = `✓ ${item.name} (${item.type}) → ${'$'.repeat(priceLevel)}`
      console.log(`[backfill-price-levels] ${msg}`)
      results.push(msg)
      updated++
    } else {
      const msg = `- ${item.name} (${item.type}) → no price level`
      console.log(`[backfill-price-levels] ${msg}`)
      results.push(msg)
      skipped++
    }

    // Brief pause between API calls
    await new Promise(r => setTimeout(r, 150))
  }

  return Response.json({ updated, skipped, total: items.length, results })
}
