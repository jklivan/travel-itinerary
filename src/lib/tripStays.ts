// Which days of a day-by-day trip are spent where. Destinations are visited in order: a hotel with a check-in day
// and nights fixes its destination's days (check-in through the last night); otherwise the destination's own
// "days" count follows on from the previous stop. Destinations with neither have no days of their own.

export type StayHotel = { name: string; type: string; day: number | null; nights?: number | null }
export type StayDestination = { id: string; name: string; days?: number | null; items: StayHotel[] }
export type DayRange = { start: number; end: number }

export function destinationRanges(destinations: StayDestination[]): Map<string, DayRange> {
  const ranges = new Map<string, DayRange>()
  let next = 1
  for (const destination of destinations) {
    const hotels = destination.items.filter(item => item.type === 'hotel' && item.day !== null && item.nights)
    let range: DayRange | null = null
    if (hotels.length) range = { start: Math.min(...hotels.map(hotel => hotel.day!)), end: Math.max(...hotels.map(hotel => hotel.day! + hotel.nights! - 1)) }
    else if (destination.days && destination.days > 0) range = { start: next, end: next + destination.days - 1 }
    if (range) { ranges.set(destination.id, range); next = range.end + 1 }
  }
  return ranges
}

// Where you are on a day: the destination whose days include it, and the hotel you're staying at that night.
export function stayOn(day: number, destinations: StayDestination[], ranges = destinationRanges(destinations)) {
  const destination = destinations.find(candidate => { const range = ranges.get(candidate.id); return range && day >= range.start && day <= range.end })
  const hotel = destinations.flatMap(candidate => candidate.items).find(item => item.type === 'hotel' && item.day !== null && item.nights && day >= item.day && day < item.day + item.nights)
  return { destination: destination?.name, hotel: hotel?.name }
}

// Days the destinations add up to, for the trip length.
export function totalDays(destinations: StayDestination[]) {
  const ranges = [...destinationRanges(destinations).values()]
  return ranges.length ? Math.max(...ranges.map(range => range.end)) : 0
}
