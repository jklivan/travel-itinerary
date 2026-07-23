export const TAGS = [
  { id: 'adventure',  label: 'Adventure',  emoji: '🏔️' },
  { id: 'beach',      label: 'Beach',       emoji: '🏖️' },
  { id: 'city',       label: 'City',        emoji: '🏙️' },
  { id: 'culture',    label: 'Culture',     emoji: '🏛️' },
  { id: 'food',       label: 'Food',        emoji: '🍜' },
  { id: 'hiking',     label: 'Hiking',      emoji: '🥾' },
  { id: 'history',    label: 'History',     emoji: '📜' },
  { id: 'luxury',     label: 'Luxury',      emoji: '💎' },
  { id: 'nature',     label: 'Nature',      emoji: '🌿' },
  { id: 'nightlife',  label: 'Nightlife',   emoji: '🎉' },
  { id: 'relaxing',   label: 'Relaxing',    emoji: '🌴' },
  { id: 'road-trip',  label: 'Road Trip',   emoji: '🚗' },
  { id: 'romantic',   label: 'Romantic',    emoji: '💕' },
  { id: 'shopping',   label: 'Shopping',    emoji: '🛍️' },
  { id: 'wildlife',   label: 'Wildlife',    emoji: '🦁' },
] as const

export type TagId = typeof TAGS[number]['id']

export function tagMeta(id: string) {
  return TAGS.find((t) => t.id === id)
}
