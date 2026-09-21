import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

type Point = { latitude: number; longitude: number }
type SearchArea = { includedRegionCodes: string[] } | { locationRestriction: { circle: { center: Point; radius: number } } | { rectangle: { low: Point; high: Point } } }
// Cache successful resolutions only. A temporary Google failure must not disable
// destination filtering for the lifetime of the server.
const areaCache = new Map<string, { area: SearchArea; expires: number }>()
function validPoint(point: Point | undefined): point is Point {
  return !!point && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180
}
async function resolveDestination(destination: string): Promise<SearchArea | null> {
  const key = destination.toLowerCase().trim()
  const cached = areaCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.area
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY!, 'X-Goog-FieldMask': 'suggestions.placePrediction.placeId' },
      body: JSON.stringify({ input: destination, languageCode: 'en', includedPrimaryTypes: ['(regions)'] }),
    })
    if (!response.ok) return null
    const placeId = (await response.json()).suggestions?.[0]?.placePrediction?.placeId
    if (!placeId) return null
    const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': API_KEY!, 'X-Goog-FieldMask': 'location,viewport,types,addressComponents' },
    })
    if (!detailsResponse.ok) return null
    const details = await detailsResponse.json()
    const types: string[] = details.types ?? []
    let area: SearchArea
    if (types.includes('country')) {
      const country = details.addressComponents?.find((component: { types?: string[] }) => component.types?.includes('country'))?.shortText
      if (typeof country !== 'string' || !/^[a-z]{2}$/i.test(country)) return null
      // A country is not a 50 km circle around its center. Restrict to the whole
      // country, including cities at its edges (e.g. Geneva in Switzerland).
      area = { includedRegionCodes: [country.toLowerCase()] }
    } else if (types.some(type => type.startsWith('administrative_area_level_')) && validPoint(details.viewport?.low) && validPoint(details.viewport?.high)) {
      area = { locationRestriction: { rectangle: details.viewport } }
    } else if (validPoint(details.location)) {
      area = { locationRestriction: { circle: { center: details.location, radius: 50000 } } }
    } else return null
    if (areaCache.size >= 256) areaCache.delete(areaCache.keys().next().value!)
    areaCache.set(key, { area, expires: Date.now() + 3600000 })
    return area
  } catch { return null }
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

  // Never drop an explicit destination and silently search worldwide.
  const area = city && type !== 'destination' ? await resolveDestination(city) : null
  // If the destination resolver is temporarily unavailable, keep the location
  // context in Google's query instead of failing or searching the whole world.
  // A resolved area still takes precedence and provides the strict geographic
  // restriction when available.

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

  const base = { input: city && type !== 'destination' && !area ? `${q}, ${city}` : q, languageCode: 'en', ...(area ?? {}) }

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
