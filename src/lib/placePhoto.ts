export type PhotoAttribution = { displayName: string; uri?: string }
export type PlacePhoto = { url: string; authors: PhotoAttribution[]; mapsUrl: string; placeId: string }
type Candidate = { id?: string; displayName?: { text?: string }; formattedAddress?: string; photos?: { name?: string; authorAttributions?: PhotoAttribution[] }[] }
const words = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function matchesPlace(name: string, city: string, candidate: Candidate) {
  const wanted = words(name).split(' ').filter(word => !['the', 'hotel', 'restaurant'].includes(word))
  const found = words(candidate.displayName?.text ?? '').split(' ').filter(word => !['the', 'hotel', 'restaurant'].includes(word))
  if (!wanted.length || !found.length || !words(city)) return false
  const cityNames = words(city) === 'ibiza' || words(city) === 'eivissa' ? ['ibiza', 'eivissa'] : [words(city)]
  // Conservative: every requested name word must match, with few added words.
  return wanted.every(word => found.includes(word)) && wanted.length / found.length >= 0.75
    && cityNames.some(cityName => words(candidate.formattedAddress ?? '').includes(cityName))
}

// Looser check for places in the viewer's own trip that have no Google ID yet: every word of the name must
// be in Google's name (so "Hotel Romazzino" finds "Romazzino, A Belmond Hotel"), and the address must be in
// the destination's city or country. Only the top result is considered.
export function loosePlaceMatch(name: string, city: string, country: string | null | undefined, candidate: Candidate) {
  const wanted = words(name).split(' ').filter(word => word && !['the', 'hotel', 'restaurant'].includes(word))
  const found = words(candidate.displayName?.text ?? '').split(' ')
  const address = words(candidate.formattedAddress ?? '')
  // Destinations are sometimes one string ("Costa Smeralda, Italy"), so every part counts.
  const places = [...city.split(','), country ?? ''].map(words).filter(Boolean)
  return wanted.length > 0 && wanted.every(word => found.includes(word)) && places.some(place => address.includes(place))
}

export async function findPlacePhoto(place: { name: string; city: string; country?: string | null; placeId?: string | null; loose?: boolean }, apiKey: string): Promise<PlacePhoto | null> {
  const headers = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey }
  const signal = AbortSignal.timeout(8000)
  try {
    let candidate: Candidate | undefined
    if (place.placeId) {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(place.placeId)}`, {
        headers: { ...headers, 'X-Goog-FieldMask': 'id,photos' }, cache: 'no-store', signal,
      })
      if (!response.ok) return null
      candidate = await response.json()
    } else {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST', headers: { ...headers, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.photos' },
        body: JSON.stringify({ textQuery: [place.name, place.city, place.country].filter(Boolean).join(', '), pageSize: 3 }), cache: 'no-store', signal,
      })
      if (!response.ok) return null
      const data = await response.json() as { places?: Candidate[] }
      const matches = (data.places ?? []).filter(candidate => matchesPlace(place.name, place.city, candidate))
      const top = data.places?.[0]
      if (matches.length === 1) candidate = matches[0]
      else if (place.loose && !matches.length && top && loosePlaceMatch(place.name, place.city, place.country, top)) candidate = top
      else return null
    }
    const photo = candidate?.photos?.[0]
    if (!photo?.name || !/^places\/[^/]+\/photos\/[^/]+$/.test(photo.name) || !candidate?.id) return null
    const response = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&skipHttpRedirect=true`, { headers, cache: 'no-store', signal })
    if (!response.ok) return null
    const data = await response.json() as { photoUri?: string }
    if (!data.photoUri || !data.photoUri.startsWith('https://')) return null
    return { url: data.photoUri, authors: (photo.authorAttributions ?? []).map(author => ({ displayName: author.displayName, uri: author.uri?.startsWith('https://') ? author.uri : undefined })), mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(candidate.id)}`, placeId: candidate.id }
  } catch { return null }
}
