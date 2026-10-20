import { samePlaceName } from './planPlaceIdentity'

// Whether an imported place is one the trip already has. "sure" merges it without asking; otherwise the person is
// asked (same place, or add it as new). Sure means: one place in the trip with that name (or nearly: "Mayflower Inn"
// and "The Mayflower Inn & Spa"), the same kind of place, and no day or date that disagrees.
export type ExistingPlace = { id: string; name: string; type: string; date: string | null; day: number | null }
export type ImportCandidate = { name: string; type: string; date?: string | null; day?: number | null }
export type ImportMatch = { id: string; name: string; sure: boolean; reason: string }

const words = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()

export function importMatch(existing: ExistingPlace[], place: ImportCandidate): ImportMatch | null {
  const candidates = existing.filter(item => samePlaceName(item.name, place.name))
  if (!candidates.length) return null
  // The closest: same kind first, then an exact name.
  const ranked = [...candidates].sort((a, b) => Number(b.type === place.type) - Number(a.type === place.type) || Number(words(b.name) === words(place.name)) - Number(words(a.name) === words(place.name)))
  const best = ranked[0]
  const reasons: string[] = []
  if (candidates.filter(item => item.type === place.type).length > 1) reasons.push('more than one place in your trip has this name')
  if (best.type !== place.type) reasons.push('it’s filed as a different kind of place')
  if (best.date && place.date && best.date !== place.date) reasons.push('the dates are different')
  else if (best.day != null && place.day != null && best.day !== place.day && place.type !== 'hotel') reasons.push('they’re on different days')
  return { id: best.id, name: best.name, sure: !reasons.length, reason: reasons.join('; ') }
}
