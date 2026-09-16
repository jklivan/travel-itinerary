export type PlaceIdentityInput = { name: string; lat?: number | null; lng?: number | null; destination: { name: string; country: string | null; lat?: number | null; lng?: number | null } }
export type GoogleIdentity = { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number }; addressComponents?: { longText?: string; shortText?: string; types?: string[] }[] }
function normalized(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '') }
function country(value: string) {
  const name = normalized(value)
  return ['us', 'usa', 'united states', 'united states of america'].includes(name) ? 'us' : ['uk', 'gb', 'united kingdom', 'great britain'].includes(name) ? 'gb' : name
}
function distance(lat: number, lng: number, otherLat: number, otherLng: number) {
  const rad = Math.PI / 180
  const a = Math.sin((otherLat - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(otherLat * rad) * Math.sin((otherLng - lng) * rad / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
export function choosePlaceIdentity(input: PlaceIdentityInput, candidates: GoogleIdentity[]) {
  const name = normalized(input.name)
  if (name.length < 3) return { match: null, reason: 'Name is too short to match confidently.' }
  const valid = candidates.filter(candidate => {
    const location = candidate.location
    if (!candidate.id || !location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return false
    const candidateName = normalized(candidate.displayName?.text ?? '')
    const exactName = name === candidateName
    const prefixName = candidateName.startsWith(name + ' ') || name.startsWith(candidateName + ' ')
    if (!exactName && !prefixName) return false
    const components = candidate.addressComponents ?? []
    const candidateCountry = components.find(part => part.types?.includes('country'))
    if (input.destination.country && (!candidateCountry || ![candidateCountry.longText, candidateCountry.shortText].some(value => value && country(value) === country(input.destination.country!)))) return false
    const destinationName = normalized(input.destination.name.split(',')[0])
    const addressMatches = components.some(part => !part.types?.includes('country') && [part.longText, part.shortText].some(value => value && normalized(value) === destinationName))
    const destinationNearby = input.destination.lat != null && input.destination.lng != null && distance(input.destination.lat, input.destination.lng, location.latitude, location.longitude) <= 30
    if (!addressMatches && !destinationNearby) return false
    const hasPlaceCoords = input.lat != null && input.lng != null
    const placeNearby = hasPlaceCoords && distance(input.lat!, input.lng!, location.latitude, location.longitude) <= 1
    if (hasPlaceCoords && !placeNearby) return false
    // Shortened business names need the stronger corroboration of existing coordinates.
    return exactName || placeNearby
  })
  const unique = [...new Map(valid.map(candidate => [candidate.id!, candidate])).values()]
  return unique.length === 1 ? { match: unique[0], reason: 'Name and location agree.' } : { match: null, reason: unique.length > 1 ? 'Several nearby places match; needs review.' : 'No confident name and location match.' }
}
export async function resolvePlaceIdentity(input: PlaceIdentityInput) {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API
  if (!key) throw Error('Google Places API key is not configured.')
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents' },
    body: JSON.stringify({ textQuery: [input.name, input.destination.name, input.destination.country].filter(Boolean).join(', '), pageSize: 10 }),
    signal: AbortSignal.timeout(7000),
  })
  if (!response.ok) throw Error(`Google Places lookup failed (${response.status}).`)
  const data = await response.json() as { places?: GoogleIdentity[] }
  return choosePlaceIdentity(input, data.places ?? [])
}
