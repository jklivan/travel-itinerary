import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { inferPriceLevels } from '@/lib/inferPriceLevels'

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE:    1,
  PRICE_LEVEL_MODERATE:       2,
  PRICE_LEVEL_EXPENSIVE:      3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

async function searchGooglePrice(name: string, context: string): Promise<number | null> {
  if (!GOOGLE_API_KEY) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
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

  // Pass 1: Google Places
  const googleMissed: typeof items = []
  for (const item of items) {
    const context = [item.destination.name, item.destination.country].filter(Boolean).join(', ')
    const price = await searchGooglePrice(item.name, context)
    if (price !== null) {
      await prisma.destItem.update({ where: { id: item.id }, data: { priceLevel: price } })
      const msg = `✓ ${item.name} (${item.type}) → ${'$'.repeat(price)} [google]`
      console.log(`[backfill-price-levels] ${msg}`)
      results.push(msg)
      updated++
    } else {
      googleMissed.push(item)
    }
    await new Promise(r => setTimeout(r, 150))
  }

  // Pass 2: Claude inference for everything Google missed
  if (googleMissed.length > 0) {
    console.log(`[backfill-price-levels] ${googleMissed.length} items going to Claude inference`)
    const inferred = await inferPriceLevels(
      googleMissed.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type as 'hotel' | 'food_drink',
        destination: [item.destination.name, item.destination.country].filter(Boolean).join(', '),
      }))
    )

    for (const item of googleMissed) {
      const price = inferred.get(item.id)
      if (price != null) {
        await prisma.destItem.update({ where: { id: item.id }, data: { priceLevel: price } })
        const msg = `✓ ${item.name} (${item.type}) → ${'$'.repeat(price)} [claude]`
        console.log(`[backfill-price-levels] ${msg}`)
        results.push(msg)
        updated++
      } else {
        const msg = `- ${item.name} (${item.type}) → no price level`
        console.log(`[backfill-price-levels] ${msg}`)
        results.push(msg)
        skipped++
      }
    }
  }

  return Response.json({ updated, skipped, total: items.length, results })
}
