import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE:   1,
  PRICE_LEVEL_MODERATE:      2,
  PRICE_LEVEL_EXPENSIVE:     3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('id')?.trim()
  if (!placeId) return Response.json({ priceLevel: null, website: null })
  if (!API_KEY) return Response.json({ priceLevel: null, website: null })

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'priceLevel,location,websiteUri',
        },
        signal: AbortSignal.timeout(4000),
      }
    )
    if (!res.ok) return Response.json({ priceLevel: null, website: null })
    const data = await res.json()
    const priceLevel = PRICE_LEVEL_MAP[data.priceLevel as string] ?? null
    const lat = data.location?.latitude ?? null
    const lng = data.location?.longitude ?? null
    return Response.json({ priceLevel, lat, lng, website: data.websiteUri ?? null })
  } catch {
    return Response.json({ priceLevel: null, website: null })
  }
}
