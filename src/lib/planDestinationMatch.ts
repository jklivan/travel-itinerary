import { samePlanDestination } from './planPlaceIdentity'

// Which of a plan's destinations a place copied from someone else's trip (or a snapshot) belongs under.
// Your destinations are the buckets: a place joins one when it's the same destination, when its town or address
// names it ("Barano d'Ischia" → Ischia), or when it's the nearest one within 30 km. Otherwise there's no clear
// answer (undefined), and the person is asked which destination to file it under.

type Coords = { lat: number | null; lng: number | null }
export type PlanDestination = { name: string; country: string | null } & Coords & { items?: Coords[] }
export type CopiedPlace = { destination: { name: string; country?: string | null } & Partial<Coords>; address?: string | null } & Partial<Coords>

const NEARBY_KM = 30
const PLACEHOLDER = 'Destination to decide'

const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase()
const town = (name: string) => plain(name.split(',')[0]).trim()
function kmApart(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
const located = (value: Partial<Coords> | undefined): value is { lat: number; lng: number } => value?.lat != null && value?.lng != null
// Countries only rule a match out when both are known and clearly differ ("Italy" vs "France").
const countryOf = (value?: string | null) => value ? plain(value.split(',').at(-1)!).trim() : ''
const sameCountry = (a?: string | null, b?: string | null) => !countryOf(a) || !countryOf(b) || countryOf(a) === countryOf(b)

export function planDestinationFor<T extends PlanDestination>(destinations: T[], place: CopiedPlace): T | undefined {
  const real = destinations.filter(destination => destination.name !== PLACEHOLDER)
  const exact = real.find(destination => samePlanDestination(destination, place.destination))
  if (exact) return exact
  const placeCountry = place.destination.country ?? place.destination.name
  const candidates = real.filter(destination => sameCountry(destination.country ?? destination.name, placeCountry))
  // Its town or address names your destination as a whole word: "Barano d'Ischia" or "80077 Ischia NA" → Ischia.
  const text = plain([place.destination.name, place.destination.country, place.address].filter(Boolean).join(', '))
  const named = candidates.filter(destination => {
    const name = town(destination.name)
    return name.length >= 3 && new RegExp(`(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(text)
  })
  if (named.length) return named.sort((a, b) => town(b.name).length - town(a.name).length)[0]
  // Otherwise the nearest destination within 30 km, measured to the destination or any place already in it.
  const point = located(place) ? place : located(place.destination) ? place.destination : null
  if (!point) return undefined
  let best: { destination: T; km: number } | undefined
  for (const destination of candidates) {
    for (const spot of [destination, ...(destination.items ?? [])].filter(located)) {
      const km = kmApart(point, spot)
      if (km <= NEARBY_KM && (!best || km < best.km)) best = { destination, km }
    }
  }
  return best?.destination
}

// For the "Which destination?" question: your destinations, nearest first (ones with no location last).
export function destinationsByDistance<T extends PlanDestination>(destinations: T[], place: CopiedPlace): T[] {
  const point = located(place) ? place : located(place.destination) ? place.destination : null
  const distance = (destination: T) => {
    if (!point) return Infinity
    const spots = [destination, ...(destination.items ?? [])].filter(located)
    return spots.length ? Math.min(...spots.map(spot => kmApart(point, spot))) : Infinity
  }
  return destinations.filter(destination => destination.name !== PLACEHOLDER).map(destination => ({ destination, km: distance(destination) }))
    .sort((a, b) => a.km - b.km).map(entry => entry.destination)
}
