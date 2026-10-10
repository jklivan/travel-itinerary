// near: where the reader thought the place is, when it's filed under another destination (helps find it on Google).
// date/time/endDate/endTime: the booking's real date and time from the document (see lib/placeDates). nights: a stay's
// length when both its dates are known. file: which document it came from, when several are imported at once.
export type ImportedPlace = { name: string; destination: string; country: string; type: string; notes: string; day: number | null; rating: number | null; mealType: string; near?: { name: string; country: string }
  date: string | null; time: string | null; endDate: string | null; endTime: string | null; nights: number | null; file?: string }
import { isDate, isTime, daysBetween } from './placeDates'

export function importedPlaces(data: unknown): ImportedPlace[] {
  if (!data || typeof data !== 'object' || !('destinations' in data) || !Array.isArray(data.destinations)) return []
  return data.destinations.flatMap(destination => {
    if (!destination || typeof destination.name !== 'string' || !Array.isArray(destination.items)) return []
    return destination.items.flatMap((item: Record<string, unknown>) => {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || !['hotel', 'food_drink', 'activity', 'transport'].includes(String(item.type))) return []
      return [{ name: item.name.trim(), destination: destination.name.trim(), country: typeof destination.country === 'string' ? destination.country : '', type: String(item.type), notes: typeof item.notes === 'string' ? item.notes : '', day: item.type !== 'hotel' && Number.isInteger(item.dayIndex) && Number(item.dayIndex) > 0 && Number(item.dayIndex) <= 365 ? Number(item.dayIndex) : null, rating: Number.isInteger(item.rating) && Number(item.rating) >= 1 && Number(item.rating) <= 5 ? Number(item.rating) : null, mealType: typeof item.mealType === 'string' ? item.mealType : '', ...when(item) }]
    })
  })
}

// A place's date and time from the document, only when they're well formed; a stay's nights from its two dates.
function when(item: Record<string, unknown>) {
  const date = isDate(item.date) ? item.date : null
  const endDate = date && isDate(item.endDate) && item.endDate >= date ? item.endDate : null
  const nights = item.type === 'hotel' && date && endDate ? daysBetween(date, endDate) : 0
  return { date, time: isTime(item.time) ? item.time : null, endDate, endTime: isTime(item.endTime) ? item.endTime : null, nights: nights >= 1 && nights <= 60 ? nights : null }
}
