import type { Period } from './hours'

// Google Places (New) and Routes, with the server's key. Field masks keep each call to what the tools use.
const key = () => process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API ?? ''

export type FoundPlace = {
  id: string; name: string; address?: string; types?: string[]; location?: { lat: number; lng: number }
  rating?: number; ratings?: number; priceLevel?: string; status?: string; mapsUrl?: string
}
export type PlaceDetails = FoundPlace & {
  website?: string; phone?: string; summary?: string; utcOffsetMinutes?: number; weekdayHours?: string[]
  periods?: Period[]; specialDays?: { date: string }[]; currentPeriods?: Period[]
}

type Raw = { id: string; displayName?: { text?: string }; formattedAddress?: string; types?: string[]; location?: { latitude: number; longitude: number }; rating?: number; userRatingCount?: number; priceLevel?: string; businessStatus?: string; googleMapsUri?: string
  websiteUri?: string; nationalPhoneNumber?: string; editorialSummary?: { text?: string }; utcOffsetMinutes?: number
  regularOpeningHours?: { periods?: Period[]; weekdayDescriptions?: string[] }; currentOpeningHours?: { periods?: Period[]; specialDays?: { date: { year: number; month: number; day: number } }[] } }

const simplify = (place: Raw): FoundPlace => ({ id: place.id, name: place.displayName?.text ?? '', address: place.formattedAddress, types: place.types?.slice(0, 5),
  location: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : undefined, rating: place.rating, ratings: place.userRatingCount,
  priceLevel: place.priceLevel?.replace('PRICE_LEVEL_', '').toLowerCase(), status: place.businessStatus, mapsUrl: place.googleMapsUri })

const SEARCH_FIELDS = 'places.id,places.displayName,places.formattedAddress,places.types,places.location,places.rating,places.userRatingCount,places.priceLevel,places.businessStatus,places.googleMapsUri'

export async function searchPlaces(query: string, near?: { lat: number; lng: number }, limit = 8, signal?: AbortSignal): Promise<FoundPlace[]> {
  if (!key()) throw new Error('Google Places is not set up.')
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST', signal: signal ?? AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': SEARCH_FIELDS },
    body: JSON.stringify({ textQuery: query, pageSize: limit, ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 30000 } } } : {}) }),
  })
  if (!response.ok) throw new Error(`Google Places search failed (${response.status}).`)
  return (((await response.json()) as { places?: Raw[] }).places ?? []).map(simplify)
}

const DETAIL_FIELDS = 'id,displayName,formattedAddress,types,location,rating,userRatingCount,priceLevel,businessStatus,googleMapsUri,websiteUri,nationalPhoneNumber,editorialSummary,utcOffsetMinutes,regularOpeningHours,currentOpeningHours'

export async function placeDetails(placeId: string, signal?: AbortSignal): Promise<PlaceDetails> {
  if (!key()) throw new Error('Google Places is not set up.')
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, { signal: signal ?? AbortSignal.timeout(10_000), headers: { 'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': DETAIL_FIELDS } })
  if (!response.ok) throw new Error(`Google Places details failed (${response.status}).`)
  const place = await response.json() as Raw
  const pad = (n: number) => String(n).padStart(2, '0')
  return { ...simplify(place), website: place.websiteUri, phone: place.nationalPhoneNumber, summary: place.editorialSummary?.text, utcOffsetMinutes: place.utcOffsetMinutes,
    weekdayHours: place.regularOpeningHours?.weekdayDescriptions, periods: place.regularOpeningHours?.periods, currentPeriods: place.currentOpeningHours?.periods,
    specialDays: place.currentOpeningHours?.specialDays?.map(day => ({ date: `${day.date.year}-${pad(day.date.month)}-${pad(day.date.day)}` })) }
}

// A place to route from or to: a Google place id, or a written address/name, or coordinates.
export type Stop = { placeId?: string; address?: string; lat?: number; lng?: number }
const waypoint = (stop: Stop) => stop.placeId ? { placeId: stop.placeId } : stop.lat !== undefined && stop.lng !== undefined ? { location: { latLng: { latitude: stop.lat, longitude: stop.lng } } } : { address: stop.address }

export type Mode = 'DRIVE' | 'WALK' | 'TRANSIT' | 'BICYCLE'
export async function travelTime(from: Stop, to: Stop, mode: Mode, departure?: string, signal?: AbortSignal) {
  if (!key()) throw new Error('Google is not set up.')
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST', signal: signal ?? AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters' },
    body: JSON.stringify({ origin: waypoint(from), destination: waypoint(to), travelMode: mode, ...(mode === 'DRIVE' ? { routingPreference: 'TRAFFIC_AWARE' } : {}), ...(departure ? { departureTime: departure } : {}) }),
  })
  if (!response.ok) throw new Error(`Google Routes failed (${response.status}).`)
  const route = ((await response.json()) as { routes?: { duration?: string; distanceMeters?: number }[] }).routes?.[0]
  if (!route) return null
  const minutes = Math.round(Number((route.duration ?? '0s').replace('s', '')) / 60)
  // Our own wording: Google's follows the place's language ("15 minutos" in Lisbon) whatever is asked for.
  const text = minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`
  return { minutes, km: route.distanceMeters ? Math.round(route.distanceMeters / 100) / 10 : null, text }
}
