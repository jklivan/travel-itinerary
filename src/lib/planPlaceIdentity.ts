type Destination = { name: string; country?: string | null }
export type PlanPlaceIdentity = { name: string; type: string; placeId?: string | null; destination: Destination }

function normalize(value: string) { return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ') }
// Google suggestions often put region text before the country ("Metropolitan City of Naples, Italy"),
// so only the last part is treated as the country.
function countryOf(value: string) { return normalize(value.split(',').at(-1) ?? '') }
export function samePlanDestination(a: Destination, b: Destination) {
  return normalize(a.name.split(',')[0]) === normalize(b.name.split(',')[0]) &&
    (!a.country || !b.country || countryOf(a.country) === countryOf(b.country))
}
// Which of a trip's destinations a place goes under: the one picked (by id), else one with exactly that name, else
// one that loosely matches ("Capri" for "Capri, Italy"). A loose match alone can't tell apart two destinations
// that start the same, so pickers send the id.
export function pickPlanDestination<T extends Destination & { id: string }>(destinations: T[], choice: { id?: string; name: string }) {
  return destinations.find(d => choice.id && d.id === choice.id)
    ?? destinations.find(d => choice.name && normalize(d.name) === normalize(choice.name))
    ?? destinations.find(d => choice.name && samePlanDestination(d, { name: choice.name })) ?? null
}
export function samePlanPlace(a: PlanPlaceIdentity, b: PlanPlaceIdentity) {
  if (a.placeId && b.placeId) return a.placeId === b.placeId
  return a.type === b.type && normalize(a.name) === normalize(b.name) && samePlanDestination(a.destination, b.destination)
}

// Snapshots: the same Google place, or (when either has no Google id) the same name in the same destination,
// whatever category it was filed under, since a snapshot's category is picked by hand.
export function sameSnapshotPlace(a: Omit<PlanPlaceIdentity, 'type'>, b: Omit<PlanPlaceIdentity, 'type'>) {
  if (a.placeId && b.placeId) return a.placeId === b.placeId
  return normalize(a.name) === normalize(b.name) && samePlanDestination(a.destination, b.destination)
}

export function planSuggestionQuery(title: string, destinations: Destination[]) {
  const destination = destinations.find(d => d.name !== 'Destination to decide')
  if (destination) return destination.name.split(',')[0].trim()
  // Plans can start with only a title, e.g. "London w kids".
  return title.replace(/^trip to\s+/i, '').replace(/\s+(?:with|w\/?)\s+(?:the\s+)?kids\b.*$/i, '').trim().slice(0, 160)
}
