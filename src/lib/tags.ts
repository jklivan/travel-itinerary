export const TAGS = [
  { id: 'day-trip', label: 'Day trips', emoji: '📍' },
  { id: 'adventure',  label: 'Adventure',  emoji: '🏔️' },
  { id: 'beach',      label: 'Beach',       emoji: '🏖️' },
  { id: 'city',       label: 'City',        emoji: '🏙️' },
  { id: 'culture',    label: 'Culture',     emoji: '🏛️' },
  { id: 'food',       label: 'Food',        emoji: '🍜' },
  { id: 'history',    label: 'History',     emoji: '📜' },
  { id: 'luxury',     label: 'Luxury',      emoji: '💎' },
  { id: 'nature',     label: 'Nature',      emoji: '🌿' },
  { id: 'nightlife',  label: 'Nightlife',   emoji: '🎉' },
  { id: 'relaxing',   label: 'Relaxing',    emoji: '🌴' },
  { id: 'road-trip',  label: 'Road Trip',   emoji: '🚗' },
  { id: 'romantic',   label: 'Romantic',    emoji: '💕' },
  { id: 'shopping',   label: 'Shopping',    emoji: '🛍️' },
  { id: 'skiing',     label: 'Skiing',      emoji: '⛷️' },
  { id: 'wildlife',   label: 'Wildlife',    emoji: '🦁' },
] as const

export type TagId = typeof TAGS[number]['id']

// Retired tags still on older trips, and the tag they now count as.
const RETIRED_TAGS: Record<string, string> = { hiking: 'nature' }

export function tagMeta(id: string) {
  return TAGS.find((t) => t.id === (RETIRED_TAGS[id] ?? id))
}

// The stored tags that match a chosen tag, e.g. Nature also finds trips tagged with the old Hiking.
export function storedTags(ids: string[]) {
  return [...new Set(ids.flatMap(id => [id, ...Object.keys(RETIRED_TAGS).filter(old => RETIRED_TAGS[old] === id)]))]
}
