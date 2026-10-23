import { samePlanDestination } from './planPlaceIdentity'
import { stayLookAlikes, type PlanDestination } from './planDestinationMatch'

// After Plan with AI adds its picks to a trip, the stops it made on its own are folded into the trip without
// asking (the planner's "look like the same place", "Same hotel, same stay?" and "only has your flights"
// questions). Only stops made entirely of AI picks are folded: anything the person set up is still asked about.
type Item = { lat: number | null; lng: number | null; type: string; sourceKind: string | null }
export type TidyDestination = Omit<PlanDestination, 'items'> & { id: string; order: number; items: Item[] }

const PLACEHOLDER = 'Destination to decide'
const onlyAi = (destination: TidyDestination) => destination.items.length > 0 && destination.items.every(item => item.sourceKind === 'ai')

// The next fold to make, or null when there's nothing left to fold.
export function nextAiFold<T extends TidyDestination>(destinations: T[]): { from: T; into: T } | null {
  const real = destinations.filter(d => d.name !== PLACEHOLDER).sort((a, b) => a.order - b.order)
  // The same destination twice ("Capri" and "Capri, Italy"): the AI-only one joins the other (the shorter name
  // when both are the AI's).
  for (const from of real.filter(onlyAi)) {
    const into = real.filter(d => d.id !== from.id && samePlanDestination(d, from))
      .sort((a, b) => Number(onlyAi(a)) - Number(onlyAi(b)) || a.name.length - b.name.length)[0]
    if (into && (!onlyAi(into) || into.name.length <= from.name.length)) return { from, into }
  }
  // Near the hotel of another stop: same hotel, same stay.
  const stay = stayLookAlikes(real).find(pair => onlyAi(pair.other))
  if (stay) return { from: stay.other, into: stay.keep }
  // A stop that only holds the AI's flights or transfers: into the next real stop, else the one before.
  for (const [index, from] of real.entries()) {
    if (!onlyAi(from) || from.items.some(item => item.type !== 'transport')) continue
    const isReal = (d: T) => d.items.some(item => item.type !== 'transport')
    const into = real.slice(index + 1).find(isReal) ?? real.slice(0, index).reverse().find(isReal)
    if (into) return { from, into }
  }
  return null
}
