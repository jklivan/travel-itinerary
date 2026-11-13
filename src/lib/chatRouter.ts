import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// The AI planner's router: a quick first look at each message (about a second), before the main planner starts.
// It writes the reply's opening line, shown straight away, and decides which lookups this answer needs, so the
// planner only looks up what changes the answer and writes from what it knows otherwise. Every place it recommends
// is still checked on Google before its card shows (closed ones are left out), so answering from memory is safe.
export const LOOKUPS = ['places', 'hours', 'weather', 'hotel_prices', 'events', 'tours', 'web'] as const
export type Lookup = typeof LOOKUPS[number]
export type Route = { opener: string; lookups: Lookup[]; weather: { place: string; start_date: string; end_date: string } | null }

// The planner's tools each kind of lookup allows.
export const LOOKUP_TOOLS: Record<Lookup, string[]> = {
  places: ['search_places', 'place_details'], hours: ['opening_hours', 'travel_time'], weather: ['weather'],
  hotel_prices: ['hotel_prices'], events: ['local_events'], tours: ['tours', 'tour_details'], web: ['web_search', 'web_fetch'],
}

const GUIDE = `You're the first step of Postcard's AI trip planner. Read the traveler's newest message (with the end of the conversation for context) and return two things, before the main planner writes its answer.

1. opener: the first sentence of the planner's reply, shown to them instantly while the full answer is worked out. One short, warm sentence (at most 20 words) reacting to what they said, specific to it ("Lisbon in May with an 8- and 11-year-old is a great call."). Not "Great question" or other filler. Never name places to visit, give facts that could be wrong (prices, hours, weather), promise what comes next, or ask a question. Return "" when the message is a short reply to the planner's question ("yes", "4 days", "just us two", a date), a thank-you, or anything where an opening line would sound odd.

2. lookups: which live lookups the planner needs before it can answer this message well. Most messages need none: the planner knows destinations, hotels, restaurants and sights, and every place it suggests is checked on Google afterwards. Only include one when it changes the answer:
- places: they want something very specific that's hard to know from memory (a dietary need, "near our hotel", a small town, a particular kind of place), or ask about a specific place's reviews or details.
- hours: the trip has exact dates and they want a day-by-day plan or a plan for a specific day or time (places close some days).
- weather: they ask about the weather, or the trip has dates or a month and the plan depends on it (beach, hiking, skiing, outdoor plans).
- hotel_prices: they ask what hotels cost, about their budget for stays, or for cheaper or better-value places to stay; or they just gave dates or guests the planner asked for in order to check prices.
- events: they ask what's on (concerts, sports, shows, festivals) for their dates.
- tours: they ask about tours, tickets or activities to book.
- web: a seasonal place or activity that might be closed when they go (mountain lifts, summer-only spots, ski areas off-season), a festival's dates, or something only a place's own website would say.

3. weather: when lookups includes weather and you know where and when (exact dates, or a month: use the 7 days from the 10th of the next such month after today), the town or city and dates; otherwise null.`

const SCHEMA = {
  type: 'object' as const, additionalProperties: false, required: ['opener', 'lookups', 'weather'],
  properties: {
    opener: { type: 'string' },
    lookups: { type: 'array', items: { type: 'string', enum: [...LOOKUPS] } },
    weather: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['place', 'start_date', 'end_date'], properties: { place: { type: 'string' }, start_date: { type: 'string' }, end_date: { type: 'string' } } }] },
  },
}

// Null when the router isn't available or takes too long: the planner then works as before (any lookups, no opener).
export async function routeMessage(input: { message: string; recent: string; trip: string; today: string }): Promise<Route | null> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: GUIDE,
      tools: [{ name: 'route', description: 'The opening line and the lookups this answer needs.', input_schema: SCHEMA }],
      tool_choice: { type: 'tool', name: 'route' },
      messages: [{ role: 'user', content: `Today is ${input.today}.\n${input.trip}\n<conversation_so_far>\n${input.recent || '(new conversation)'}\n</conversation_so_far>\n<newest_message>\n${input.message}\n</newest_message>` }],
    }, { signal: AbortSignal.timeout(4000) })
    const block = response.content.find(part => part.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return null
    const raw = block.input as { opener?: unknown; lookups?: unknown; weather?: unknown }
    const lookups = Array.isArray(raw.lookups) ? [...new Set(raw.lookups.filter((item): item is Lookup => (LOOKUPS as readonly string[]).includes(item as string)))] : []
    const weather = raw.weather && typeof raw.weather === 'object' ? raw.weather as Route['weather'] : null
    const opener = typeof raw.opener === 'string' ? raw.opener.trim().slice(0, 200) : ''
    return { opener, lookups, weather: weather && typeof weather.place === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weather.start_date) && /^\d{4}-\d{2}-\d{2}$/.test(weather.end_date) ? weather : null }
  } catch (error) {
    console.warn('[planner] router skipped', error instanceof Error ? error.message : error)
    return null
  }
}
