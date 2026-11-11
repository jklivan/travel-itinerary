// Who a trip was with: one of four, shown on trip cards in the feed and chosen (filled in for you) when posting.
// "adult" is from before Solo: still read, no longer offered.
export const AUDIENCES = [
  { id: 'friends', label: 'Friends' },
  { id: 'family', label: 'Family' },
  { id: 'romantic', label: 'Couples' },
  { id: 'solo', label: 'Solo' },
] as const
export const AUDIENCE_IDS = ['friends', 'family', 'romantic', 'solo', 'adult']

export const audienceLabel = (id: string | null | undefined) => id === 'adult' ? 'Adults' : AUDIENCES.find(audience => audience.id === id)?.label ?? null

// From who's going: children make it family; one adult solo, two a couple, more friends.
export function audienceFor(travelers: { adults: number; childAges: number[] } | null | undefined) {
  if (!travelers) return null
  if (travelers.childAges.length) return 'family'
  return travelers.adults <= 1 ? 'solo' : travelers.adults === 2 ? 'romantic' : 'friends'
}
