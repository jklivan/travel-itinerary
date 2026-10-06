import { prisma } from '@/lib/prisma'

// Saves a map spot (lat/lng) for a trip's places that don't have one, so posted trips show them on the map.
// Google's suggestions only give a place's ID, not where it is, so this looks each one up afterwards:
// by its Google ID when it has one (exact), otherwise by name, searched near the trip's other places.
// A name search can find a namesake far away ("Hotel Caruso, Italy" → Rimini instead of Ravello), so results
// far from the rest of the trip are rejected, and pins that already sit far from the rest are rechecked.

type Spot = { lat: number; lng: number }
type Found = Spot & { id: string; name: string }

const NEAR_KM = 60
const FAR_KM = 150

function apiKey() { return process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API }
function kmApart(a: Spot, b: Spot) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
// The found place is the one named: every distinctive word of the shorter name is in the other
// ("Hotel Caruso" / "Caruso, A Belmond Hotel, Amalfi Coast"). Words like "hotel" or "the" don't count.
const COMMON = new Set(['a', 'an', 'the', 'and', 'of', 'at', 'in', 'on', 'by', 'hotel', 'hotels', 'resort', 'spa', 'restaurant', 'ristorante', 'trattoria', 'cafe', 'bar', 'inn', 'villa', 'la', 'le', 'il', 'el', 'de', 'di', 'da', 'del', 'du'])
const words = (value: string) => plain(value).split(' ').filter(word => word && !COMMON.has(word))
export const sameName = (a: string, b: string) => {
  const [short, long] = [words(a), words(b)].sort((x, y) => x.length - y.length)
  if (!short.length) return plain(a) === plain(b)
  return short.every(word => long.includes(word))
}

async function locationById(placeId: string): Promise<Spot | null> {
  const key = apiKey()
  if (!key) return null
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location' }, signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    const place = await response.json() as { location?: { latitude: number; longitude: number } }
    return place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null
  } catch { return null }
}

async function searchByName(query: string, near: Spot | null): Promise<Found[]> {
  const key = apiKey()
  if (!key) return []
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location' },
      body: JSON.stringify({ textQuery: query, maxResultCount: 5, ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50000 } } } : {}) }),
    })
    if (!response.ok) return []
    const data = await response.json() as { places?: { id: string; displayName?: { text?: string }; location?: { latitude: number; longitude: number } }[] }
    return (data.places ?? []).filter(place => place.location).map(place => ({ id: place.id, name: place.displayName?.text ?? '', lat: place.location!.latitude, lng: place.location!.longitude }))
  } catch { return [] }
}

// The middle of a set of spots (median, so one stray pin doesn't move it).
function middle(spots: Spot[]): Spot | null {
  if (!spots.length) return null
  const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] }
  return { lat: median(spots.map(spot => spot.lat)), lng: median(spots.map(spot => spot.lng)) }
}

// Whether a trip's places need looking up: one has no spot, or one sits far away while the rest are together.
export function needsLocating(places: { type: string; name: string; lat: number | null; lng: number | null }[]) {
  const mappable = places.filter(place => place.type !== 'transport' && place.name)
  if (mappable.some(place => place.lat == null)) return true
  const spots = mappable as Spot[]
  return spots.some(spot => {
    const others = spots.filter(other => other !== spot)
    const center = middle(others)
    return others.length >= 3 && !!center && kmApart(center, spot) > FAR_KM && others.filter(other => kmApart(center, other) <= NEAR_KM).length >= Math.ceil(others.length * 0.6)
  })
}

// Trips looked up recently on this server, so places Google can't find aren't searched again on every view.
const recent = new Map<string, number>()
const RETRY_MS = 6 * 60 * 60 * 1000

export async function locateTripPlaces(itineraryId: string, limit = 60) {
  const last = recent.get(itineraryId)
  if (last && Date.now() - last < RETRY_MS) return
  recent.set(itineraryId, Date.now())
  if (recent.size > 2000) recent.delete(recent.keys().next().value!)
  const destinations = await prisma.destination.findMany({
    where: { itineraryId }, select: { id: true, name: true, country: true, lat: true, lng: true,
      items: { where: { type: { not: 'transport' }, name: { not: '' } }, select: { id: true, name: true, placeId: true, lat: true, lng: true } } },
  })
  const all = destinations.flatMap(destination => destination.items.map(item => ({ ...item, destination })))
  // 1. Places with a Google ID: their exact spot.
  let lookups = 0
  for (const item of all) {
    if (lookups >= limit) return
    if (!item.placeId || item.lat !== null) continue
    lookups++
    const spot = await locationById(item.placeId)
    if (spot && (await prisma.destItem.updateMany({ where: { id: item.id, placeId: item.placeId, lat: null }, data: spot })).count) Object.assign(item, spot)
  }
  const located = () => all.filter(item => item.lat !== null && item.lng !== null) as (typeof all[number] & Spot)[]
  // Where a place in this destination should be: its other located places, else the destination, else the whole trip.
  const anchor = (item: typeof all[number]) => {
    const others = located().filter(other => other.id !== item.id)
    const here = others.filter(other => other.destination.id === item.destination.id)
    return middle(here.length ? here : []) ?? (item.destination.lat != null && item.destination.lng != null ? { lat: item.destination.lat, lng: item.destination.lng } : null) ?? middle(others)
  }
  const find = async (item: typeof all[number]) => {
    const near = anchor(item)
    const query = [item.name, item.destination.name, item.destination.country].filter(Boolean).join(', ')
    const results = await searchByName(query, near)
    // A result far from the rest of the trip is a namesake somewhere else, not this place.
    return results.find(result => sameName(result.name, item.name) && (!near || kmApart(near, result) <= FAR_KM)) ?? (near ? undefined : results[0])
  }
  // 2. Places without a spot: searched by name near the trip's other places.
  for (const item of all) {
    if (lookups >= limit) return
    if (item.lat !== null) continue
    lookups++
    const found = await find(item)
    if (!found) continue
    const data = { lat: found.lat, lng: found.lng, ...(!item.placeId ? { placeId: found.id } : {}) }
    if ((await prisma.destItem.updateMany({ where: { id: item.id, lat: null }, data })).count) Object.assign(item, data)
  }
  // 3. Pins far from the rest of their trip while the rest sit together: rechecked, and moved only when the
  // same-named place turns up near the others (a real far-off stop keeps its pin).
  for (const item of located()) {
    if (lookups >= limit) return
    const others = located().filter(other => other.id !== item.id)
    const center = middle(others)
    if (others.length < 3 || !center || kmApart(center, item) <= FAR_KM) continue
    if (others.filter(other => kmApart(center, other) <= NEAR_KM).length < Math.ceil(others.length * 0.6)) continue
    lookups++
    const results = await searchByName([item.name, item.destination.name, item.destination.country].filter(Boolean).join(', '), center)
    const better = results.find(result => sameName(result.name, item.name) && kmApart(center, result) <= NEAR_KM)
    if (better) await prisma.destItem.updateMany({ where: { id: item.id, lat: item.lat, lng: item.lng }, data: { lat: better.lat, lng: better.lng, placeId: better.id } })
  }
}
