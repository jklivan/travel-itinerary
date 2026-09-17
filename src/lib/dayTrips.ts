export const DAY_TRIP_TAG = 'day-trip'

type Trip = {
  durationDays?: number | null; tags?: readonly string[]; postType: string; datesFlexible?: boolean
  startDate: Date; endDate: Date
  destinations?: readonly { items: readonly { type: string; dayIndex?: number | null }[] }[]
}

export function hasTripDates(trip: Trip) {
  if (trip.datesFlexible || trip.postType === 'guide') return false
  const start = new Date(trip.startDate), end = new Date(trip.endDate)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false
  return start.getTime() !== end.getTime() || start.toISOString().slice(11) === '00:00:00.000Z'
}

// Old imports used the save timestamp for both dates when no dates were supplied.
export function tripDuration(trip: Trip): number | null {
  const scheduled = (trip.destinations ?? []).flatMap(destination => {
    const days = destination.items.filter(item => item.type !== 'hotel' && item.dayIndex != null).map(item => item.dayIndex!)
    const offset = days.includes(0) ? 1 : 0
    return days.map(day => day + offset)
  })
  // A guide's old default Day 1 is not evidence of an actual daily schedule.
  const scheduledDays = Math.max(0, ...scheduled)
  const start = new Date(trip.startDate)
  const end = new Date(trip.endDate)
  const placeholder = !trip.datesFlexible && !hasTripDates(trip)
  const schedule = (trip.postType === 'guide' || placeholder) && scheduledDays <= 1 ? 0 : scheduledDays
  const datedDays = hasTripDates(trip)
    ? Math.round((Date.parse(end.toISOString().slice(0, 10)) - Date.parse(start.toISOString().slice(0, 10))) / 86400000) + 1
    : 0
  const days = Math.max(schedule, datedDays, trip.durationDays ?? 0)
  if (days > 0) return days
  return trip.tags?.includes(DAY_TRIP_TAG) ? 1 : null
}

export function isDayTrip(trip: Trip) {
  const days = tripDuration(trip)
  return days !== null && days >= 1 && days <= 2
}
