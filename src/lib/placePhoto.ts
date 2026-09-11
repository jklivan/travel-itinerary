export type PhotoAttribution = { displayName: string; uri?: string }
export type PlacePhoto = { url: string; authors: PhotoAttribution[]; mapsUrl: string }
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

export async function findPlacePhoto(place: { name: string; city: string; country?: string | null; placeId?: string | null }, apiKey: string): Promise<PlacePhoto | null> {
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
      if (matches.length !== 1) return null
      candidate = matches[0]
    }
    const photo = candidate?.photos?.[0]
    if (!photo?.name || !/^places\/[^/]+\/photos\/[^/]+$/.test(photo.name) || !candidate?.id) return null
    const response = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&skipHttpRedirect=true`, { headers, cache: 'no-store', signal })
    if (!response.ok) return null
    const data = await response.json() as { photoUri?: string }
    if (!data.photoUri || !data.photoUri.startsWith('https://')) return null
    return { url: data.photoUri, authors: (photo.authorAttributions ?? []).map(author => ({ displayName: author.displayName, uri: author.uri?.startsWith('https://') ? author.uri : undefined })), mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(candidate.id)}` }
  } catch { return null }
}
