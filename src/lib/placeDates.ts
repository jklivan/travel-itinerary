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

// Problems to show before importing: dates outside the trip, and two places to stay on the same night.
export function dateProblems(places: Checked[], trip: { start: string; end: string } | null): (string | null)[] {
  return places.map((place, index) => {
    if (!place.date) return null
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
