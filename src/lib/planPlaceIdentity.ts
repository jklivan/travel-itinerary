type Destination = { name: string; country?: string | null }
export type PlanPlaceIdentity = { name: string; type: string; placeId?: string | null; destination: Destination }

function normalize(value: string) { return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ') }
export function samePlanDestination(a: Destination, b: Destination) {
  return normalize(a.name.split(',')[0]) === normalize(b.name.split(',')[0]) &&
    (!a.country || !b.country || normalize(a.country) === normalize(b.country))
}
export function samePlanPlace(a: PlanPlaceIdentity, b: PlanPlaceIdentity) {
  if (a.placeId && b.placeId) return a.placeId === b.placeId
  return a.type === b.type && normalize(a.name) === normalize(b.name) && samePlanDestination(a.destination, b.destination)
}

export function planSuggestionQuery(title: string, destinations: Destination[]) {
  const destination = destinations.find(d => d.name !== 'Destination to decide')
  if (destination) return destination.name.split(',')[0].trim()
  // Plans can start with only a title, e.g. "London w kids".
  return title.replace(/^trip to\s+/i, '').replace(/\s+(?:with|w\/?)\s+(?:the\s+)?kids\b.*$/i, '').trim().slice(0, 160)
}
