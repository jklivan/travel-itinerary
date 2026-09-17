export const DAY_TRIP_TAG = 'day-trip'

// Dates are inclusive: a same-day outing is one day; an overnight is two.
// Guides and flexible plans need an explicit tag because their dates are placeholders.
export function isDayTrip(trip: { tags: readonly string[]; postType: string; datesFlexible: boolean; startDate: Date; endDate: Date }) {
  if (trip.postType === 'guide' || trip.datesFlexible) return trip.tags.includes(DAY_TRIP_TAG)
  const start = Date.parse(trip.startDate.toISOString().slice(0, 10))
  const end = Date.parse(trip.endDate.toISOString().slice(0, 10))
  const days = (end - start) / 86400000 + 1
  return days >= 1 && days <= 2
}
