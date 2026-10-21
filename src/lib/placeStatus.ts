import { matchesPlace } from '@/lib/placePhoto'

// Whether a place is open for business, from Google Places. Plan with AI never shows a place that isn't operating
// (closed permanently or for now). "unknown" (no key, not found, a different place came back, or the lookup failed)
// keeps the place: a failed check shouldn't hide a good suggestion.
// renamed: Google knows the place only under a new name (Park Hyatt Mallorca is now Cap Vermell Grand Hotel).
export type PlaceStatus = 'operating' | 'closed' | 'unknown' | { renamed: string; placeId: string }
type Found = { id?: string; displayName?: { text?: string }; formattedAddress?: string; businessStatus?: string; types?: string[] }

const key = () => process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

const statusOf = (place: Found | null): PlaceStatus => !place?.businessStatus ? 'unknown'
  : place.businessStatus === 'OPERATIONAL' ? 'operating'
  : place.businessStatus === 'CLOSED_PERMANENTLY' || place.businessStatus === 'CLOSED_TEMPORARILY' ? 'closed' : 'unknown'

// The same kind of place, from Google's types: a hotel for a hotel, somewhere to eat or drink for a restaurant.
function sameKind(type: string | undefined, types: string[] = []) {
  if (type === 'hotel') return types.some(t => t === 'lodging' || t.includes('hotel') || t === 'resort_hotel')
  if (type === 'food_drink') return types.some(t => /restaurant|cafe|bar|bakery|food|meal/.test(t))
  return !!type
}
const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
// The same name (every word of ours in Google's, with few extra), whatever language the address is in: the search
// already named the town, and Google writes addresses locally ("Lisboa" for Lisbon).
const generic = ['the', 'hotel', 'restaurant', 'restaurante', 'ristorante', 'hostal', 'hotels', 'resort', 'and', 'de', 'del', 'la', 'el', 'es', 'sa', 'le', 'les', 'di', 'da', 'do', 'des']
const nameWords = (value: string) => plain(value).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(word => word && !generic.includes(word))
function sameName(name: string, found: string | undefined) {
  const wanted = nameWords(name), got = nameWords(found ?? '')
  return !!wanted.length && !!got.length && wanted.every(word => got.includes(word)) && wanted.length / got.length >= 0.75
}

export async function placeStatus(query: { placeId?: string | null; name: string; city: string; country?: string | null; type?: string }): Promise<PlaceStatus> {
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
      method: 'POST', signal, headers: { ...headers, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.businessStatus,places.types' },
      body: JSON.stringify({ textQuery: [query.name, query.city, query.country].filter(Boolean).join(', '), pageSize: 3 }),
    })
    if (!response.ok) return 'unknown'
    const places = ((await response.json()) as { places?: Found[] }).places ?? []
    // Only trust a result that is clearly the same place.
    const same = places.find(place => matchesPlace(query.name, query.city, place) || sameName(query.name, place.displayName?.text))
    if (same) return statusOf(same)
    // A rename: Google keeps old names as aliases, so a search by the old name returns just the one place, under
    // its new name. A name Google doesn't know returns several unrelated places instead, so only exactly one result
    // of the same kind in the same town counts.
    const only = places.length === 1 ? places[0] : null
    if (only?.id && only.displayName?.text && plain(only.formattedAddress ?? '').includes(plain(query.city)) && sameKind(query.type, only.types)) {
      const status = statusOf(only)
      // Sharing a real word ("Cuevas del Drach" / "Coves del Drach", "Es Molí d'en Bou" / "Es Molí Restaurant") is
      // the same place under another spelling, not a new name.
      const shared = nameWords(query.name).some(word => word.length >= 4 && nameWords(only.displayName.text).includes(word))
      return status === 'operating' && !shared ? { renamed: only.displayName.text, placeId: only.id } : status
    }
    return 'unknown'
  } catch { return 'unknown' }
}
