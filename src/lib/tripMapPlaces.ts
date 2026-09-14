export type TripMapPlace = {
  id: string
  name: string
  city: string
  type: 'hotel' | 'food_drink' | 'activity'
  day: number | null
  placeId?: string
}

export function tripMapLookupKey(place: TripMapPlace): string {
  return place.placeId
    ? `id:${place.placeId}`
    : `q:${[place.name.trim(), place.city.trim()].filter(Boolean).join(', ')}`
}

export function validMapLocation(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== 'object') return false
  const { lat, lng } = value as { lat?: unknown; lng?: unknown }
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
}
