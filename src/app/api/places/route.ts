import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

// Simple in-process geocode cache so repeated autocomplete calls for the same
// city don't hit the Geocoding API every time.
const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const key = city.toLowerCase().trim()
  if (geocodeCache.has(key)) return geocodeCache.get(key)!
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${API_KEY}`
    )
    if (!res.ok) { geocodeCache.set(key, null); return null }
    const data = await res.json()
    const loc = data.results?.[0]?.geometry?.location
    const coords = loc ? { lat: loc.lat as number, lng: loc.lng as number } : null
    geocodeCache.set(key, coords)
    return coords
  } catch {
    geocodeCache.set(key, null)
    return null
  }
}

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    console.error('[places] GOOGLE_PLACES_API_KEY is not set')
    return Response.json([])
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  const type = req.nextUrl.searchParams.get('type') ?? 'destination'
  const city = req.nextUrl.searchParams.get('city')?.trim() || null

  if (!q || q.length < 2) return Response.json([])

  // Bias results toward the current destination city when provided
  const cityCoords = city ? await geocodeCity(city) : null
  const locationBias = cityCoords
    ? { circle: { center: { latitude: cityCoords.lat, longitude: cityCoords.lng }, radius: 50000 } }
    : undefined

  type RawSuggestion = {
    placePrediction?: {
      placeId?: string
      text?: { text: string }
      structuredFormat?: {
        mainText?: { text: string }
        secondaryText?: { text: string }
      }
    }
  }

  async function autocomplete(body: Record<string, unknown>) {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': '*',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[places] API error:', JSON.stringify(err))
      return []
    }
    const data = await res.json()
    return (data.suggestions ?? []) as RawSuggestion[]
  }

  function toSuggestion(s: RawSuggestion, isAddress = false) {
    const p = s.placePrediction ?? {}
    const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? ''
    const secondary = p.structuredFormat?.secondaryText?.text ?? ''
    // For address results, fold city into the label so the stored name is unambiguous
    const label = isAddress && secondary ? `${main}, ${secondary}` : (p.text?.text ?? main)
    return { label, main: isAddress && secondary ? label : main, secondary, placeId: p.placeId ?? null }
  }

  let rawResults: RawSuggestion[]

  const base = { input: q, languageCode: 'en', ...(locationBias ? { locationBias } : {}) }

  if (type === 'hotel') {
    // Run both queries in parallel: named lodging + free-text addresses
    const [lodgingRaw, addressRaw] = await Promise.all([
      autocomplete({ ...base, includedPrimaryTypes: ['lodging'] }),
      autocomplete(base),
    ])
    // Merge: lodging results first, then address results not already present
    const seen = new Set(lodgingRaw.map(s => s.placePrediction?.placeId).filter(Boolean))
    const merged = [
      ...lodgingRaw.map(s => toSuggestion(s, false)),
      ...addressRaw
        .filter(s => !seen.has(s.placePrediction?.placeId))
        .map(s => toSuggestion(s, true)),
    ]
    return Response.json(merged.slice(0, 7))
  }

  try {
    rawResults = await autocomplete(base)
  } catch (err) {
    console.error('[places] fetch error:', err)
    return Response.json([])
  }

  const suggestions = rawResults.slice(0, 6).map(s => toSuggestion(s))
  return Response.json(suggestions)
}
