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

// The Plan with Postcard start page: When (Dates), Somewhere nearby, With friends and Vibe.
export const WHEN = ['This weekend', 'Next weekend', 'I’m flexible', 'Specific dates'] as const
export const DISTANCES = ['Up to 1 hour', 'Up to 2 hours', 'Up to 4 hours', 'A short flight'] as const
export const VIBES = ['Relaxing', 'Adventure', 'Food & wine', 'Luxury', 'Culture', 'Family fun', 'Beach', 'Outdoors', 'City'] as const
// "With friends" shows these words for TRAVELERS.
export const TRAVELER_LABELS: Record<typeof TRAVELERS[number], string> = { Solo: 'Just me', Couple: 'Couples trip', Friends: 'Friends trip', 'Family with kids': 'Family with kids' }

// The chat message sent when the setup questions are answered.
export const SETUP_MESSAGE = 'Show me trip ideas that fit what I picked.'

export type TravelPreferences = {
  travelers: string
  length: string
  budget: number | null
  destinationTypes: string[]
  activities: string[]
  when?: string
  startDate?: string
  endDate?: string
  distance?: string
  from?: string
  vibes?: string[]
  // People you follow whose places to lean on: ids from the page, names filled in by the server.
  friendIds?: string[]
  friends?: string[]
}

// Keeps only known choices, so a tampered request can't inject text into the prompt.
export function cleanPreferences(value: unknown): TravelPreferences | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const pick = (options: readonly string[], raw: unknown) => typeof raw === 'string' && options.includes(raw) ? raw : ''
  const pickMany = (options: readonly string[], raw: unknown) => Array.isArray(raw) ? [...new Set(raw.filter((item): item is string => typeof item === 'string' && options.includes(item)))] : []
  const budget = BUDGETS.some(option => option.value === input.budget) ? input.budget as number : null
  const date = (raw: unknown) => typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : ''
  const when = pick(WHEN, input.when)
  const startDate = when === 'Specific dates' ? date(input.startDate) : ''
  const endDate = startDate ? date(input.endDate) : ''
  const distance = pick(DISTANCES, input.distance)
  // Where "nearby" starts from is typed, so only plain words, kept short.
  const from = distance && typeof input.from === 'string' ? input.from.replace(/[^\p{L}\p{N} ,.'’-]/gu, '').trim().slice(0, 80) : ''
  const friendIds = Array.isArray(input.friendIds) ? [...new Set(input.friendIds.filter((id): id is string => typeof id === 'string' && /^[a-z0-9]{10,40}$/i.test(id)))].slice(0, 20) : []
  const preferences: TravelPreferences = { travelers: pick(TRAVELERS, input.travelers), length: pick(TRIP_LENGTHS, input.length), budget, destinationTypes: pickMany(DESTINATION_TYPES, input.destinationTypes), activities: pickMany(ACTIVITIES, input.activities),
    ...(when && { when }), ...(startDate && { startDate }), ...(endDate && endDate >= startDate && { endDate }), ...(distance && { distance }), ...(from && { from }),
    ...(pickMany(VIBES, input.vibes).length && { vibes: pickMany(VIBES, input.vibes) }), ...(friendIds.length && { friendIds }) }
  return preferences.travelers || preferences.length || budget || preferences.destinationTypes.length || preferences.activities.length
    || when || distance || preferences.vibes?.length || friendIds.length ? preferences : null
}

export function describePreferences(preferences: TravelPreferences) {
  const budget = BUDGETS.find(option => option.value === preferences.budget)
  return [
    preferences.travelers && `Who's going: ${preferences.travelers}`,
    preferences.length && `Trip length: ${preferences.length}`,
    budget && `Budget: ${budget.label} (${budget.hint})`,
    preferences.destinationTypes.length && `Types of destination: ${preferences.destinationTypes.join(', ')}`,
    preferences.activities.length && `Likes to do: ${preferences.activities.join(', ')}`,
    preferences.when && `When: ${preferences.when === 'Specific dates' && preferences.startDate ? `${preferences.startDate}${preferences.endDate ? ` to ${preferences.endDate}` : ''}` : preferences.when}`,
    preferences.distance && `Somewhere nearby: ${preferences.distance}${preferences.from ? ` from ${preferences.from}` : ' from where they live (ask if you don\'t know)'}`,
    preferences.vibes?.length && `Vibe: ${preferences.vibes.join(', ')}`,
    preferences.friends?.length && `Lean on places these friends loved: ${preferences.friends.join(', ')}`,
  ].filter(Boolean).join('\n')
}

// The question the start page asks when only choices were made, in words: "Show me trip ideas within 2 hours of
// Greenwich for this weekend, for a couple, with a relaxing, beach vibe, using places Jen loved."
export const PICKS_PREFIX = 'Show me trip ideas'
export function picksQuestion(preferences: TravelPreferences, formatDate: (date: string) => string) {
  const distance = { 'Up to 1 hour': 'within an hour', 'Up to 2 hours': 'within 2 hours', 'Up to 4 hours': 'within 4 hours', 'A short flight': 'a short flight away' }[preferences.distance ?? ''] ?? ''
  const from = preferences.from ? (preferences.distance === 'A short flight' ? ` from ${preferences.from}` : ` of ${preferences.from}`) : ''
  const when = preferences.when === 'Specific dates' && preferences.startDate ? `for ${formatDate(preferences.startDate)}${preferences.endDate ? ` – ${formatDate(preferences.endDate)}` : ''}`
    : { 'This weekend': 'for this weekend', 'Next weekend': 'for next weekend', 'I’m flexible': 'with flexible dates' }[preferences.when ?? ''] ?? ''
  const who = { Solo: 'for just me', Couple: 'for a couple', Friends: 'for a friends trip', 'Family with kids': 'for a family with kids' }[preferences.travelers] ?? ''
  const vibe = preferences.vibes?.length ? `with a ${preferences.vibes.join(', ').toLowerCase()} vibe` : ''
  const friends = preferences.friends?.length ? `using places ${preferences.friends.map(name => name.split(' ')[0]).join(' and ')} loved` : ''
  const budgetOption = BUDGETS.find(option => option.value === preferences.budget)
  const budget = budgetOption ? `${budgetOption.label} ${budgetOption.hint.toLowerCase()}` : ''
  const first = [PICKS_PREFIX, distance && `${distance}${from}`, when].filter(Boolean).join(' ')
  const rest = [who, vibe, budget, friends].filter(Boolean)
  // "Show me trip ideas for a couple, …", or after a distance or date: "…within 2 hours, for a couple, …".
  return `${first}${rest.length ? `${first === PICKS_PREFIX ? ' ' : ', '}${rest.join(', ')}` : ''}.`
}
