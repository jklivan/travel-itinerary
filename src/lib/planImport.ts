// near: where the reader thought the place is, when it's filed under another destination (helps find it on Google).
// rating: always empty; only the traveller rates places (a guide's "3 Michelin keys" isn't their rating).
// date/time/endDate/endTime: the booking's real date and time from the document (see lib/placeDates). nights: a stay's
// length when both its dates are known. file: which document it came from, when several are imported at once.
export type ImportedPlace = { name: string; destination: string; country: string; type: string; notes: string; day: number | null; rating: number | null; mealType: string; near?: { name: string; country: string }
  date: string | null; time: string | null; endDate: string | null; endTime: string | null; nights: number | null; file?: string }
import { isDate, isTime, daysBetween } from './placeDates'

export function importedPlaces(data: unknown): ImportedPlace[] {
  if (!data || typeof data !== 'object' || !('destinations' in data) || !Array.isArray(data.destinations)) return []
  return fileTransport(data.destinations.flatMap(destination => {
    if (!destination || typeof destination.name !== 'string' || !Array.isArray(destination.items)) return []
    return destination.items.flatMap((item: Record<string, unknown>) => {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || !['hotel', 'food_drink', 'activity', 'transport'].includes(String(item.type))) return []
      return [{ name: item.name.trim(), destination: destination.name.trim(), country: typeof destination.country === 'string' ? destination.country : '', type: String(item.type), notes: typeof item.notes === 'string' ? item.notes : '', day: Number.isInteger(item.dayIndex) && Number(item.dayIndex) > 0 && Number(item.dayIndex) <= 365 ? Number(item.dayIndex) : null, rating: null, mealType: typeof item.mealType === 'string' ? item.mealType : '', ...when(item) }]
    })
  }))
}

// A place's date and time from the document, only when they're well formed; a stay's nights from its two dates.
function when(item: Record<string, unknown>) {
  const date = isDate(item.date) ? item.date : null
  const endDate = date && isDate(item.endDate) && item.endDate >= date ? item.endDate : null
  const nights = item.type === 'hotel' && date && endDate ? daysBetween(date, endDate) : 0
  // Hotels in a day-by-day plan without dates: the nights the document gives.
  const stated = item.type === 'hotel' && Number.isInteger(item.nights) && Number(item.nights) >= 1 && Number(item.nights) <= 60 ? Number(item.nights) : null
  return { date, time: isTime(item.time) ? item.time : null, endDate, endTime: isTime(item.endTime) ? item.endTime : null, nights: nights >= 1 && nights <= 60 ? nights : stated }
}

// Transport never makes a destination of its own (flying out of JFK isn't a stop in New York): it goes under the trip
// destination it belongs to. With dates, the stop whose places are nearest in time (the outbound flight joins the
// first stop, the flight home the last); without, the stop after it in the document, else the one before. The
// document's own city is kept as "near", which helps find the place on Google.
export function fileTransport(places: ImportedPlace[]): ImportedPlace[] {
  const stops = places.filter(place => place.type !== 'transport')
  if (!stops.length) return places
  const stopNames = new Set(stops.map(stop => stop.destination.toLowerCase()))
  return places.map((place, index) => {
    if (place.type !== 'transport' || stopNames.has(place.destination.toLowerCase())) return place
    const dated = place.date ? stops.filter(stop => stop.date) : []
    const home = dated.length
      ? dated.reduce((best, stop) => Math.abs(daysBetween(place.date!, stop.date!)) < Math.abs(daysBetween(place.date!, best.date!)) ? stop : best)
      : places.slice(index + 1).find(other => other.type !== 'transport') ?? [...places.slice(0, index)].reverse().find(other => other.type !== 'transport')!
    return { ...place, destination: home.destination, country: home.country, near: place.near ?? { name: place.destination, country: place.country } }
  })
}
