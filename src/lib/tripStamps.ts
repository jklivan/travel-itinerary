// The author's verdict on a trip, from its overall rating. Only the two ends get a stamp, matching places
// (Must do / Avoid): 5 stars is Must go!, 1 star is Avoid. 2–4 stars show no stamp.
export const TRIP_STAMPS = [
  { value: 1, label: 'Avoid' },
  { value: 5, label: 'Must go!' },
]

// Muted postage-stamp colours for the author's verdict (1 Avoid, 5 Must go!; 2–4 kept for older uses).
export const STAMP_COLORS: Record<number, string> = { 1: '#8c7b72', 2: '#b3955f', 3: '#8e9b6c', 4: '#4d6a8c', 5: '#6f8b6e' }
