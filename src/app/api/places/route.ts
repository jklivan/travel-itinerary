import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

// Geocode a city using the Places API only (no Geocoding API needed).
// Two-step: Autocomplete the city name → Place Details for lat/lng.
// Results are cached in-process so subsequent keystrokes don't repeat the calls.
const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const key = city.toLowerCase().trim()
  if (geocodeCache.has(key)) return geocodeCache.get(key)!
  try {
    // Step 1: find the city's placeId via Autocomplete
    const acRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId',
      },
      body: JSON.stringify({
        input: city,
        languageCode: 'en',
        includedPrimaryTypes: ['locality', 'administrative_area_level_2', 'administrative_area_level_3'],
      }),
    })
    if (!acRes.ok) { geocodeCache.set(key, null); return null }
    const acData = await acRes.json()
    const placeId: string | undefined = acData.suggestions?.[0]?.placePrediction?.placeId
    if (!placeId) { geocodeCache.set(key, null); return null }

    // Step 2: fetch location from Place Details
    const detRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': 'location',
      },
    })
    if (!detRes.ok) { geocodeCache.set(key, null); return null }
    const det = await detRes.json()
    const coords = det.location
      ? { lat: det.location.latitude as number, lng: det.location.longitude as number }
      : null
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

  // Restrict results to within 75 km of the destination city when provided.
  // locationRestriction (hard boundary) rather than locationBias (soft hint)
  // so out-of-area results don't slip through.
  const cityCoords = city ? await geocodeCity(city) : null
  const locationRestriction = cityCoords
    ? { circle: { center: { latitude: cityCoords.lat, longitude: cityCoords.lng }, radius: 75000 } }
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

  const base = { input: q, languageCode: 'en', ...(locationRestriction ? { locationRestriction } : {}) }

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
