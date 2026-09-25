// What the trip planner asks before its first recommendation. The trip-now questions are always asked;
// budget, destination types and activities only when the traveler has no trips of their own to learn from.

export const TRAVELERS = ['Solo', 'Couple', 'Family with kids', 'Friends'] as const
export const TRIP_LENGTHS = ['Weekend', 'About a week', 'Two weeks or more'] as const
export const BUDGETS = [
  { value: 1, label: '$', hint: 'Budget-friendly' },
  { value: 2, label: '$$', hint: 'Mid-range' },
  { value: 3, label: '$$$', hint: 'Upscale' },
  { value: 4, label: '$$$$', hint: 'Luxury' },
] as const
export const DESTINATION_TYPES = ['Beach', 'City', 'Mountains', 'Countryside', 'Islands', 'Lakes', 'Snow & ski', 'Desert'] as const
export const ACTIVITIES = ['Food & restaurants', 'Wine & bars', 'Museums & history', 'Hiking & outdoors', 'Beaches & swimming', 'Shopping', 'Nightlife', 'Spa & wellness', 'Kid-friendly activities', 'Adventure sports', 'Architecture', 'Local markets'] as const

export type TravelPreferences = {
  travelers: string
  length: string
  budget: number | null
  destinationTypes: string[]
  activities: string[]
}

// Keeps only known choices, so a tampered request can't inject text into the prompt.
export function cleanPreferences(value: unknown): TravelPreferences | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const pick = (options: readonly string[], raw: unknown) => typeof raw === 'string' && options.includes(raw) ? raw : ''
  const pickMany = (options: readonly string[], raw: unknown) => Array.isArray(raw) ? [...new Set(raw.filter((item): item is string => typeof item === 'string' && options.includes(item)))] : []
  const budget = BUDGETS.some(option => option.value === input.budget) ? input.budget as number : null
  const preferences = { travelers: pick(TRAVELERS, input.travelers), length: pick(TRIP_LENGTHS, input.length), budget, destinationTypes: pickMany(DESTINATION_TYPES, input.destinationTypes), activities: pickMany(ACTIVITIES, input.activities) }
  return preferences.travelers || preferences.length || budget || preferences.destinationTypes.length || preferences.activities.length ? preferences : null
}

export function describePreferences(preferences: TravelPreferences) {
  const budget = BUDGETS.find(option => option.value === preferences.budget)
  return [
    preferences.travelers && `Who's going: ${preferences.travelers}`,
    preferences.length && `Trip length: ${preferences.length}`,
    budget && `Budget: ${budget.label} (${budget.hint})`,
    preferences.destinationTypes.length && `Types of destination: ${preferences.destinationTypes.join(', ')}`,
    preferences.activities.length && `Likes to do: ${preferences.activities.join(', ')}`,
  ].filter(Boolean).join('\n')
}
