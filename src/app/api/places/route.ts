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

  // Bias results toward the destination city. locationBias (soft preference)
  // rather than locationRestriction so results still appear even if geocoding
  // returns slightly off coordinates or the place sits just outside the radius.
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

  if (type === 'all') {
    // Unified search: no type filter, returns results with a guessedType field
    const HOTEL_TYPES = new Set(['lodging', 'hotel', 'motel', 'hostel', 'resort_hotel', 'bed_and_breakfast', 'guest_house', 'inn', 'extended_stay_hotel', 'vacation_rental', 'campground', 'rv_park'])
    const FOOD_TYPES  = new Set(['restaurant', 'food', 'bar', 'cafe', 'bakery', 'meal_delivery', 'meal_takeaway', 'night_club', 'coffee_shop', 'sandwich_shop', 'pizza_restaurant', 'seafood_restaurant', 'fast_food_restaurant', 'chinese_restaurant', 'japanese_restaurant', 'mexican_restaurant', 'american_restaurant', 'italian_restaurant', 'steak_house', 'ice_cream_shop', 'dessert_shop', 'brunch_restaurant', 'breakfast_restaurant', 'wine_bar', 'cocktail_bar', 'pub', 'sports_bar'])

    function guessType(types?: string[]): 'hotel' | 'food_drink' | 'activity' | null {
      if (!types || types.length === 0) return null
      for (const t of types) {
        if (HOTEL_TYPES.has(t)) return 'hotel'
        if (FOOD_TYPES.has(t))  return 'food_drink'
      }
      if (types.some(t => t === 'point_of_interest' || t === 'establishment')) return 'activity'
      return null
    }

    try {
      rawResults = await autocomplete(base)
    } catch (err) {
      console.error('[places] fetch error:', err)
      return Response.json([])
    }

    type AllSuggestion = { label: string; main: string; secondary: string; placeId: string | null; guessedType: 'hotel' | 'food_drink' | 'activity' | null }
    const suggestions: AllSuggestion[] = rawResults.slice(0, 8).map(s => {
      const base = toSuggestion(s)
      const types = (s as { placePrediction?: { types?: string[] } }).placePrediction?.types
      return { ...base, guessedType: guessType(types) }
    })
    return Response.json(suggestions)
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
