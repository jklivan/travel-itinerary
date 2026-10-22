// Real dates and times on places (DestItem.date/time/endDate/endTime). Dates are "YYYY-MM-DD" and times 24-hour
// "HH:MM", both local to where the place is, so no time zone ever shifts them.

export const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
export const isTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const DAY = 86_400_000
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`)

// Days from one date to another (Apr 1 → Apr 4 is 3).
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY)
// Which day of the trip a date falls on, counting the start date as Day 1.
export const tripDay = (date: string, tripStart: string) => daysBetween(tripStart, date) + 1
export const addDays = (date: string, days: number) => new Date(utc(date) + days * DAY).toISOString().slice(0, 10)

// "Sat, Apr 5" and "7:30 pm".
export const formatDate = (date: string) => new Date(utc(date)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
export function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${hours < 12 ? 'am' : 'pm'}`
}

// The date and time line on a card: "Sat, Apr 5 · 7:30 pm", "Apr 3 – Apr 6" for a stay, or just the time.
export function whenLabel(place: { date?: string | null; time?: string | null; endDate?: string | null; endTime?: string | null }, withDate = true) {
  const parts: string[] = []
  if (withDate && place.date) parts.push(place.endDate && place.endDate !== place.date ? `${formatDate(place.date)} – ${formatDate(place.endDate)}` : formatDate(place.date))
  if (place.time) parts.push(place.endTime ? `${formatTime(place.time)} – ${formatTime(place.endTime)}` : formatTime(place.time))
  return parts.join(' · ')
}

type Checked = { type: string; name: string; date: string | null; endDate: string | null }

// Which day a place goes on, from its date: transport leaving up to two days before the trip (an overnight flight)
// goes on Day 1, and up to two days after it (the flight home) on the last day. Null when the date is further out.
export function dayOnTrip(place: { type: string; date: string | null }, trip: { start: string; end: string }) {
  if (!place.date) return null
  const day = tripDay(place.date, trip.start), last = tripDay(trip.end, trip.start)
  if (place.type === 'transport' && day < 1 && day >= -1) return 1
  if (place.type === 'transport' && day > last && day <= last + 2) return last
  return day
}

// Problems to show before importing: dates outside the trip, and two places to stay on the same night.
export function dateProblems(places: Checked[], trip: { start: string; end: string } | null): (string | null)[] {
  return places.map((place, index) => {
    if (!place.date) return null
    // Flights just before or after the trip go on its first or last day; that's expected, not a problem.
    if (trip && place.type === 'transport' && place.date >= addDays(trip.start, -2) && place.date <= addDays(trip.end, 2)) return null
    if (trip && place.date < trip.start) return `${formatDate(place.date)} is before the trip starts (${formatDate(trip.start)})`
    if (trip && place.date > trip.end) return `${formatDate(place.date)} is after the trip ends (${formatDate(trip.end)})`
    if (place.type === 'hotel') {
      const start = place.date
      const last = place.endDate && place.endDate > place.date ? addDays(place.endDate, -1) : place.date
      const clash = places.find((other, otherIndex) => otherIndex !== index && other.type === 'hotel' && other.date
        && other.date <= last && (other.endDate && other.endDate > other.date ? addDays(other.endDate, -1) : other.date) >= start)
      if (clash) return `Overlaps with ${clash.name} on the same nights`
    }
    return null
  })
}

// Trip dates that give every booking a day: a trip without dates gets the earliest to the latest booking, and a
// dated trip stretches to take in bookings up to a week outside it (an overnight flight the evening before).
// Null when nothing would change. Bookings further out stay flagged by dateProblems instead.
// The trip's dates come from where you are (stays, meals, things to do), not from getting there: an overnight flight
// that leaves the day before you land doesn't make that day Day 1. Only when the documents have nothing but transport
// do its dates count.
export function datesCovering(places: Checked[], trip: { start: string; end: string } | null, slack = 7) {
  const there = places.some(place => place.type !== 'transport' && place.date) ? places.filter(place => place.type !== 'transport') : places
  const ranges = there.flatMap(place => place.date ? [[place.date, place.endDate && place.endDate > place.date ? place.endDate : place.date]] : [])
    .filter(([from, to]) => !trip || (from >= addDays(trip.start, -slack) && to <= addDays(trip.end, slack)))
  if (!ranges.length) return null
  const start = [...ranges.map(range => range[0]), ...(trip ? [trip.start] : [])].sort()[0]
  const end = [...ranges.map(range => range[1]), ...(trip ? [trip.end] : [])].sort().at(-1)!
  if ((trip && start === trip.start && end === trip.end) || daysBetween(start, end) >= 365) return null
  return { start, end }
}
