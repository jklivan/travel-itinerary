import { matchesPlace } from '@/lib/placePhoto'

// Whether a place is open for business, from Google Places. Plan with AI never shows a place that isn't operating
// (closed permanently or for now). "unknown" (no key, not found, a different place came back, or the lookup failed)
// keeps the place: a failed check shouldn't hide a good suggestion.
export type PlaceStatus = 'operating' | 'closed' | 'unknown'
type Found = { id?: string; displayName?: { text?: string }; formattedAddress?: string; businessStatus?: string }

const key = () => process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

const statusOf = (place: Found | null): PlaceStatus => !place?.businessStatus ? 'unknown'
  : place.businessStatus === 'OPERATIONAL' ? 'operating'
  : place.businessStatus === 'CLOSED_PERMANENTLY' || place.businessStatus === 'CLOSED_TEMPORARILY' ? 'closed' : 'unknown'

export async function placeStatus(query: { placeId?: string | null; name: string; city: string; country?: string | null }): Promise<PlaceStatus> {
  const apiKey = key()
  if (!apiKey || !query.name.trim()) return 'unknown'
  const headers = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey }
  const signal = AbortSignal.timeout(5000)
  try {
    if (query.placeId) {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(query.placeId)}`, { headers: { ...headers, 'X-Goog-FieldMask': 'id,businessStatus' }, signal })
      return response.ok ? statusOf(await response.json()) : 'unknown'
    }
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', signal, headers: { ...headers, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.businessStatus' },
      body: JSON.stringify({ textQuery: [query.name, query.city, query.country].filter(Boolean).join(', '), pageSize: 3 }),
    })
    if (!response.ok) return 'unknown'
    const places = ((await response.json()) as { places?: Found[] }).places ?? []
    // Only trust a result that is clearly the same place; anything else is "unknown".
    return statusOf(places.find(place => matchesPlace(query.name, query.city, place)) ?? null)
  } catch { return 'unknown' }
}
