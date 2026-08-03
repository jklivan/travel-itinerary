import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

async function geocodeViaPlaces(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.location',
      },
      body: JSON.stringify({ textQuery: query }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const loc = data.places?.[0]?.location
    if (!loc) return null
    return { lat: loc.latitude, lng: loc.longitude }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!API_KEY) {
    return Response.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500 })
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

  console.log(`[backfill-item-coords] ${items.length} items to geocode via Google Places`)

  let geocoded = 0
  let failed = 0

  for (const item of items) {
    const query = [item.name, item.destination.name, item.destination.country].filter(Boolean).join(', ')
    const coords = await geocodeViaPlaces(query)
    if (coords) {
      await prisma.destItem.update({ where: { id: item.id }, data: coords })
      console.log(`[backfill-item-coords] ✓ "${query}" → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
      geocoded++
    } else {
      console.log(`[backfill-item-coords] ✗ "${query}" — no result`)
      failed++
    }
  }

  return Response.json({ geocoded, failed, total: items.length })
}
