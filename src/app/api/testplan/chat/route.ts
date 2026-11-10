import { placeStatus, type PlaceStatus } from '@/lib/placeStatus'
import Anthropic from '@anthropic-ai/sdk'
import { after } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { loadPlanningContext } from '@/lib/testplanContext'
import { cleanPreferences, describePreferences } from '@/lib/travelPreferences'
import type { Prisma } from '@/generated/prisma/client'
import { anthropicTools, runPlannerTool } from '@/lib/planner/registry'
import { finishedJsonItems, finishedJsonObject, partialJsonString } from '@/lib/partialJson'
import type { Ask } from '@/app/testplan/AskPicker'
import { canEdit } from '@/lib/tripAccess'

export const maxDuration = 300

const client = new Anthropic()

// The planner's lookups in the chat (lib/planner). Friends' places and the traveler's own trips are already in the
// travel data.
const CHAT_TOOLS = ['search_places', 'place_details', 'opening_hours', 'travel_time', 'weather', 'hotel_prices', 'local_events', 'tours', 'tour_details']
const STATUS: Record<string, string> = {
  search_places: 'Searching for places…', place_details: 'Checking place details…', opening_hours: 'Checking opening hours…',
  travel_time: 'Working out travel times…', weather: 'Checking the weather…', hotel_prices: 'Checking live hotel prices…',
  local_events: 'Looking for events…', tours: 'Finding tours and tickets…', tour_details: 'Checking tour details…',
}
// Limits for one answer: rounds of lookups, lookups in all, and time spent on them. Past any of them, it answers
// with what it found.
const MAX_ROUNDS = 6, MAX_LOOKUPS = 24, LOOKUP_SECONDS = 150
// The web, searched and read on Anthropic's side: a place's own site for its season or opening dates, an event's dates.
const WEB_TOOLS: Anthropic.ToolUnion[] = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 },
]

const INSTRUCTIONS = `You are Postcard's trip planner, inside Postcard, a travel app where friends share the places they've been. If you refer to yourself, you are Postcard, not Claude.
You're helping the user plan a new trip. Below is everything they and their friends have logged: trips, places, star ratings (1-5) and personal notes.

How to help:
- Lead with what their friends (and the user themselves) actually loved. Name the friend, and quote or paraphrase their note when it helps. High ratings and enthusiastic notes are the strongest signal; low ratings are warnings worth mentioning.
- Always mix in new places that are not in the travel data, marked as source "claude" — even when friends have logged plenty. For every destination you suggest, include at least one place to stay, two things to do and two places to eat that nobody in the data has been to, alongside the friends' picks. When the data has little or nothing for a destination, say so plainly and make the whole suggestion from your own picks.
- Only recommend real, specific places (a named hotel, restaurant, sight), not generic advice. Every place must be open and operating today: never recommend a place that has closed (permanently or for now), or been renamed or replaced; when you aren't sure a place still operates, pick another. Never recommend anything in <closed_places>. Keep "why" to one or two sentences.
- Don't re-recommend places already in the user's current trip.
- Keep the reply conversational and brief (a few short paragraphs at most). The recommendations list renders as cards next to your reply, so don't repeat every detail in the reply text.
- Whenever you suggest trip ideas, at least one must be a whole destination that nobody in the travel data has been to, so the user discovers somewhere new — even when friends' trips would fill the list. Name it as its own trip idea and make its places your own picks. The exception is when the user asks about one specific place (e.g. "what should we do in Lisbon?"): then stay in that place.
- When you suggest a destination, cover it as a whole trip: a place or two to stay, a few things to do, and a few places to eat. When you offer alternative destinations, do this for each one.
- Before recommending places, you need to know: what kind of trip this is now (who's going, how long), their budget, the types of destination they like, and what they like to do. Use <traveler_preferences> when present. When the user has past trips of their own, infer budget, destination types and activities from those trips (budgets, ratings, tags, places) instead of asking.
- A user with no past trips who hasn't said what they want: don't recommend yet. Ask what kind of trip, their budget and who's going in one short, friendly question, with ask kind "trip_basics" (it shows all three as choices to tap: trip types, budget levels and who's going; question "Your trip", options [], multiple false). Skip it if <traveler_preferences> or their messages already cover all three, and return an empty recommendations list until it's answered. If the travel data includes their best vacation (from sign-up), don't ask that combined question: take the kind of trip, what they like to do and who they travel with from their best vacation (unless they say otherwise), and ask only their budget, with ask kind "choose", multiple false, options "$ Budget-friendly", "$$ Mid-range", "$$$ Upscale", "$$$$ Luxury".
- A new trip where they haven't said when or for how long, or who's going (e.g. they only name a place: "Copenhagen"), and <current_trip> doesn't give its dates: before looking anything up or recommending, ask for both first in one short, friendly question ("When are you going, and who's coming? If you don't have dates yet, just tell me how many days."), with ask kind "dates_and_guests", and return an empty recommendations list. Past trips and preferences don't answer this: they say what someone likes, not this trip's length or group. Once they've answered (or said they don't know yet), go ahead.
- When a next step needs their travel dates or who's going (for example, before you can look up hotel prices), don't just mention it or offer it for later ("once you have dates"): end your reply by asking for it, e.g. "When are you looking to go?" (and who's coming, if you don't know), and set ask to "dates" or "dates_and_guests" so they can pick on a calendar.
- ask = something to tap instead of typing, for the question your reply ends with: kind "choose" with 2-8 short options (multiple true when several can apply) for any question with a small set of answers; kind "dates" when you need their travel dates; kind "guests" when you need how many adults and children (and children's ages) are going; kind "dates_and_guests" when you need both (e.g. before looking up hotel prices). question = a 2-5 word label for it. Otherwise kind "none", question "", options [], multiple false. Ask one thing at a time.
- Recommendations are optional: return an empty list when the user is just chatting or asking a question that doesn't call for places.
- Look things up instead of guessing. You have tools for real places (search_places, place_details), opening_hours on a date and time, travel_time between places, the weather for a place and dates (a forecast up to two weeks out, otherwise what it's typically like then), and hotel_prices. Use them when they change the answer:
  - Places you suggest yourself (source "claude"): when you aren't sure one is right for this traveler, search for it or for a better match ("family-friendly seafood in Cascais") and prefer well-rated places that are operating.
  - When the trip has dates and you suggest a day's plan, a specific day or a time, check opening_hours for that date (many places close one day a week) and travel_time between places you put together, and adjust.
  - local_events finds concerts, sports, theatre and festivals near a place on given dates (Ticketmaster). Use it when they ask what's on or about events, or when the dates are known and a night is free. Far-off dates often have few events listed yet: say so, and don't present festivals or events you know of as confirmed for those dates.
  - tours finds bookable tours, activities and attraction tickets (Viator), with prices; filter by the trip's dates, a minimum rating or a budget when you know them. Before recommending a tour, check the likely ones with tour_details (with the trip's dates): what's included, the meeting point, cancellation, ages, how its ratings split and whether it runs on those dates. Drop tours that don't run on their dates, don't fit (kids' ages, pace, budget) or have a noticeable share of 1-2 star ratings. For the one or two you recommend most, you may search the web for what reviewers say and use it in "why" ("reviewers love the guide; a few say it's rushed"). Give the price as "from $X" (per person unless it's a private tour) (never write a URL in "why" or the reply). Postcard doesn't book tours: if they're ready to book, say they can book it on Viator. If a tool says it isn't connected or fails, answer without it and don't mention the tool.
  - web_search and web_fetch: for what the other tools can't answer, such as a seasonal place's dates (a summer toboggan or mountain lift that Google lists as closed in the off-season), whether a festival or event is on for their dates, or a place's own site. Prefer the place's official website. Say what the site says and when it was published or updated if that matters ("their site lists the 2026 season as May–October"); if it doesn't say, say so.
  - A place Google calls "closed for now" may only be shut for the season: for mountain lifts, toboggans, beach clubs and other seasonal places, check their website before treating it as closed for the traveler's dates.
  - When the dates are known and the plan depends on the weather (beach, hiking, skiing, outdoor dining), check the weather and mention it in a sentence.
  - Put what you checked in the place's "why" when it helps, briefly: "Open Tuesdays from 7pm", "12 min walk from the Alfama", "Typically 24°C and dry in June".
  - Friends' favourite experiences (in the travel data) are the best guide to tours and things to do:
    - When a friend loved a tour or bookable activity at the traveler's destination, look for that same tour with tours (by its name and place) and, if it's there and runs on their dates, recommend it as the friend's pick (source "friend", their sourceItemId): "Joshua gave it 5 stars."
    - When friends loved a kind of experience somewhere else (a food market tour, a sunset sail, a golf-cart tour, a cooking class), search tours for that kind of experience at the traveler's destination and suggest the best match as your own pick, saying why: "Joshua loved a golf-cart tour of Rome; this one does the same around Lisbon's hills." Only when it fits this traveler (who's going, their pace and budget).
  - place_details includes a few recent Google reviews: read them before recommending a restaurant or hotel you aren't sure of, and mention anything that matters for this traveler (noisy, great with kids, slow service), briefly.
  - Make independent lookups together in one turn, and don't look up what you won't use: most answers need a few lookups or none. Never invent hours, travel times, weather or prices.
- Prices: when the user asks what hotels cost, about their budget, or for cheaper or better-value places to stay, look up live prices with the hotel_prices tool instead of estimating, and recommend hotels it returned. It needs dates and guests: use the trip's dates and travelers when you have them; otherwise ask for them in one short question before searching. Price the rooms the group needs: unless they say how they'll sleep, put up to 2 adults (plus up to 2 young children) in each room, say how you split them (e.g. "priced as 2 rooms"), and offer to check a family room or another split. Give prices as "from $X/night" for the dates you searched (for all the rooms, saying how many) and mention they're live rates that can change. Never make up a price. The tool's status says what happened: "no_availability" means the price source has the hotel (or city) but no rooms for those dates, likely sold out; "not_listed" means it isn't on the price source at all, so say you couldn't get a price, not that it's sold out; "priced_elsewhere" means the prices come from Google Hotels for reference (say so, and that they're for the whole group with the number of rooms unknown). Search only upcoming dates (today's date is given below): a month with no year means its next one, and never search or mention dates that have passed. Don't talk about how you look prices up ("my usual source", "my rate source"): say "live rates" or "a reference price from Google Hotels". Postcard doesn't book hotels: never offer to book, hold or reserve a room, and don't say whether a price can or can't be booked here. If they're ready to book, tell them to book on the hotel's own website or a booking site.

For each recommendation:
- source "friend" = from a friend's trip, "you" = from the user's own past trip, "claude" = your own suggestion.
- sourceItemId = the bracketed id of the place in the data below when source is "friend" or "you"; otherwise "".
- friendName = the friend's name when source is "friend"; otherwise "".
- destination = the city or area; country = the country.
- price = for a hotel you priced with hotel_prices, e.g. "from $420/night · Jun 3–7", or "from $780/night · 2 rooms · Jun 3–7" for more than one room; otherwise "".
- tripOption = a short name (2-4 words) for the trip idea this place belongs to, e.g. "Amalfi Coast" or "Greek islands". When you suggest alternative trips, give each its own name and use exactly the same name for every place in it. Reuse a name from earlier in the conversation when adding to that idea.
Also return, for the conversation list:
- title = a short, evocative title for the whole conversation so far (2-5 words, no quotes or emoji), e.g. "Amalfi coast honeymoon" or "Greenwich dinner favorites". Update it as the conversation develops.
- summary = one plain sentence (at most 15 words) on what's been discussed or decided so far.
- notes = this conversation's memory for later chats about the same trip: a few short phrases, separated by "; ", on what's been decided or learned (the trip idea or places they chose, dates, who's going, budget, likes and dislikes such as "no big resorts", what they've added or turned down). At most 60 words. Keep what still holds from earlier and update what changed; "" when nothing's been decided yet.
- addToTrip = true when the user approves your plan or asks to save it ("looks good", "perfect", "add them", "save this to my trip"): Postcard then adds every place from your latest plan to their trip and puts them on days, so say so briefly in the reply ("Adding these to your trip now.") and don't ask them to pick places. Otherwise false. When you offer choices after a plan, a "Looks good" option means exactly this.
- tripDays = how many days the trip is, when they've said so without dates ("5 days", "a week" = 7, "a long weekend" = 3), or worked out from tripDates; 0 until then.
- tripDates = the trip's dates once the user has given them (start and end as YYYY-MM-DD; a month with no year means its next one; work out the end from a start and a number of nights or days). "" for both until then.
- <earlier_chats_about_this_trip>, when present, holds the notes from the traveler's other conversations about this trip. Treat them as things the traveler already told you: don't ask again, and don't re-suggest what they turned down.`

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'recommendations', 'title', 'summary', 'notes', 'tripDates', 'tripDays', 'addToTrip', 'ask'],
  properties: {
    reply: { type: 'string' },
    ask: { type: 'object', additionalProperties: false, required: ['kind', 'question', 'options', 'multiple'], properties: {
      kind: { type: 'string', enum: ['none', 'choose', 'dates', 'guests', 'dates_and_guests', 'trip_basics'] },
      question: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      multiple: { type: 'boolean' },
    } },
    title: { type: 'string' },
    summary: { type: 'string' },
    notes: { type: 'string' },
    tripDates: { type: 'object', additionalProperties: false, required: ['start', 'end'], properties: { start: { type: 'string' }, end: { type: 'string' } } },
    tripDays: { type: 'integer' },
    addToTrip: { type: 'boolean' },
    recommendations: { type: 'array', items: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'type', 'destination', 'country', 'tripOption', 'why', 'price', 'source', 'sourceItemId', 'friendName'],
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['hotel', 'food_drink', 'activity'] },
        destination: { type: 'string' },
        country: { type: 'string' },
        tripOption: { type: 'string' },
        why: { type: 'string' },
        price: { type: 'string' },
        source: { type: 'string', enum: ['friend', 'you', 'claude'] },
        sourceItemId: { type: 'string' },
        friendName: { type: 'string' },
      },
    } },
  },
}

type RawRecommendation = { name: string; type: 'hotel' | 'food_drink' | 'activity'; destination: string; country: string; tripOption: string; why: string; price?: string; source: 'friend' | 'you' | 'claude'; sourceItemId: string; friendName: string }

export async function POST(request: Request) {
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 })
  const body = await request.json().catch(() => null) as { chatId?: unknown; message?: unknown; tripId?: unknown; preferences?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const tripId = typeof body?.tripId === 'string' && body.tripId ? body.tripId : undefined
  const chatId = typeof body?.chatId === 'string' && body.chatId ? body.chatId : undefined
  if (!message || message.length > 4000) return Response.json({ error: 'Write a message first.' }, { status: 400 })
  const chat = chatId ? await prisma.planChat.findFirst({ where: { id: chatId, userId } }) : null
  if (chatId && !chat) return Response.json({ error: 'This conversation is no longer available. Start a new chat.' }, { status: 404 })
  // History lives server-side and is only ever appended to, so thinking blocks are replayed unchanged.
  const history = (chat?.history ?? []) as unknown as Anthropic.MessageParam[]

  const [context, trip] = await Promise.all([
    loadPlanningContext(userId, tripId),
    tripId ? prisma.itinerary.findFirst({ where: { id: tripId, ...canEdit(userId) }, select: { title: true, startDate: true, endDate: true, datesFlexible: true, destinations: { select: { name: true, items: { select: { name: true, type: true, dayIndex: true } } } } } }) : null,
  ])
  const current = trip
    ? `<current_trip title="${trip.title}"${trip.datesFlexible ? '' : ` dates="${trip.startDate.toISOString().slice(0, 10)} to ${trip.endDate.toISOString().slice(0, 10)}"`}>\n${trip.destinations.flatMap(d => d.items.map(item => `- ${item.name} (${item.type}, ${d.name}${item.dayIndex === null ? '' : `, day ${item.dayIndex}`})`)).join('\n') || '(empty so far)'}\n</current_trip>`
    : '<current_trip>Not started yet. Adding a recommendation will create it.</current_trip>'
  // The setup answers ride along with the first message, so they stay in the conversation history.
  const preferences = cleanPreferences(body?.preferences)
  // Friends picked under "With friends": only people this traveler follows, by their real names.
  if (preferences?.friendIds?.length) {
    const follows = await prisma.follow.findMany({ where: { followerId: userId, status: 'accepted', followingId: { in: preferences.friendIds } }, select: { following: { select: { name: true } } } })
    preferences.friends = follows.map(follow => follow.following.name)
    if (!preferences.friends.length) delete preferences.friends
  }
  const traveler = `<traveler past_trips="${context.hasOwnTrips ? 'yes' : 'none'}" />`
  const preferencesBlock = preferences ? `\n<traveler_preferences>\n${describePreferences(preferences)}\n</traveler_preferences>` : ''
  // What the traveler's other conversations about this trip settled: each one's latest notes (or, for chats from
  // before notes existed, its summary), newest first.
  const otherChats = trip ? await prisma.planChat.findMany({ where: { userId, tripId, ...(chat ? { id: { not: chat.id } } : {}) }, orderBy: { updatedAt: 'desc' }, take: 8, select: { updatedAt: true, turns: true } }) : []
  const earlier = otherChats.flatMap(other => {
    const last = (other.turns as unknown as { role: string; title?: string; summary?: string; notes?: string }[]).findLast(turn => turn.role === 'assistant')
    const memory = (last?.notes || last?.summary || '').trim()
    return memory ? [`- ${other.updatedAt.toISOString().slice(0, 10)}${last?.title ? ` "${last.title}"` : ''}: ${memory}`] : []
  })
  const earlierBlock = earlier.length ? `\n<earlier_chats_about_this_trip>\n${earlier.join('\n')}\n</earlier_chats_about_this_trip>` : ''
  // Places this chat already found closed (left out of earlier answers), so they're never suggested again.
  const closedBefore = [...new Set(((chat?.turns ?? []) as unknown as { role: string; closed?: string[] }[]).flatMap(turn => turn.role === 'assistant' ? turn.closed ?? [] : []))]
  const closedBlock = closedBefore.length ? `\n<closed_places>\n${closedBefore.map(name => `- ${name}`).join('\n')}\n</closed_places>` : ''
  const userMessage: Anthropic.MessageParam = { role: 'user', content: `${current}${earlierBlock}${closedBlock}\n${traveler}${preferencesBlock}\n\n${message}` }

  // The answer streams back as lines of JSON: the reply as it's written ("delta"/"reply"), a "status" while
  // checking prices, then "done" with the saved chat and the place cards (or "error").
  const encoder = new TextEncoder()
  const owner = userId
  const origin = new URL(request.url).origin
  // Leaving the app (switching to another) drops the connection. The answer is still worked out and saved, so the
  // page picks it up when you come back (GET below); sending to a dropped connection is just skipped.
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  let disconnected = false
  const output = new ReadableStream<Uint8Array>({ start(streamController) { controller = streamController }, cancel() { disconnected = true } })
  const emit = (event: Record<string, unknown>) => {
    if (disconnected || !controller) return
    try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)) } catch { disconnected = true }
  }
  // A small line every few seconds while it works, so phones (the iPhone app especially) don't drop a connection
  // that's gone quiet during lookups; the page ignores it.
  const heartbeat = setInterval(() => emit({ type: 'ping' }), 5000)
  after(answer().finally(() => { clearInterval(heartbeat); if (!disconnected) try { controller?.close() } catch { /* already closed */ } }))
  return new Response(output, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } })

  async function answer() {
    try {
      // A new conversation is saved straight away, so its answer has somewhere to go if the page loses the connection.
      // A card for one recommendation (also sent while the answer is still being written), and the question's
      // tap-to-answer picker when it's usable.
      const card = (rec: RawRecommendation, index: number, messageId: string) => {
        const source = context.items.get(rec.sourceItemId)
        return {
          key: `${messageId}:${index}`, name: rec.name, type: rec.type, why: rec.why, price: rec.price?.trim() || '', tripOption: rec.tripOption.trim(), description: '',
          destination: source?.destination ?? rec.destination, country: source?.country ?? (rec.country || null),
          source: source ? (source.mine ? 'you' : 'friend') : 'claude' as const,
          friendName: source && !source.mine ? source.owner : '',
          sourceItemId: source?.id ?? '', placeId: source?.placeId ?? null, lat: source?.lat ?? null, lng: source?.lng ?? null,
        }
      }
      const usableAsk = (raw: Ask | null | undefined) => raw && raw.kind !== 'none' && (raw.kind !== 'choose' || raw.options.length > 1)
        ? { kind: raw.kind, question: raw.question.slice(0, 60), options: raw.options.map(option => option.trim().slice(0, 60)).filter(Boolean).slice(0, 8), multiple: !!raw.multiple } satisfies Ask : null
      const activeChatId = chat?.id ?? (await prisma.planChat.create({ data: { userId: owner, tripId: trip ? tripId : null, history: [], turns: [] }, select: { id: true } })).id
      emit({ type: 'start', chatId: activeChatId })
      // A tool loop: when the planner looks up hotel prices, run the lookups and send the results back, until it
      // answers. Every turn is kept, in order, in the saved history.
      const turns: Anthropic.MessageParam[] = [userMessage]
      let response: Anthropic.Message
      // Every pick is checked on Google as soon as it's written: closed places (permanently or for now) are never shown.
      const checks = new Map<string, Promise<PlaceStatus>>()
      const check = (rec: RawRecommendation) => {
        const key = `${rec.name}|${rec.destination}`.toLowerCase()
        if (!checks.has(key)) checks.set(key, placeStatus({ placeId: context.items.get(rec.sourceItemId)?.placeId, name: rec.name, city: rec.destination, country: rec.country, type: rec.type }))
        return checks.get(key)!
      }
      // A renamed place is shown under its current name, saying what it used to be called.
      const current = (rec: RawRecommendation, status: PlaceStatus): RawRecommendation => typeof status === 'object'
        ? { ...rec, name: status.renamed, why: `Now ${status.renamed} (formerly ${rec.name}). ${rec.why}` } : rec
      let liveRound = 0
      const started = Date.now()
      let lookups = 0, enough = false
      for (let round = 0; ; round++) {
        liveRound = round
        const stream = client.messages.stream({
          model: 'claude-opus-5-5',
          max_tokens: 32000,
          output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
          cache_control: { type: 'ephemeral' },
          system: [
            { type: 'text', text: INSTRUCTIONS },
            { type: 'text', text: `<travel_data>\n${context.text}\n</travel_data>`, cache_control: { type: 'ephemeral' } },
            // After the cached blocks, so the date changing each day doesn't undo the cache.
            { type: 'text', text: `Today is ${new Date().toISOString().slice(0, 10)}.` },
          ],
          tools: [...anthropicTools({ only: CHAT_TOOLS }), ...WEB_TOOLS],
          // Out of rounds, lookups or time: answer with what's been found.
          ...(enough ? { tool_choice: { type: 'none' as const } } : {}),
          messages: [...history, ...turns],
        })
        // The reply as it's written: send what's new each time (the whole reply again if it ever changes).
        let shown = ''
        // Then the question's picker and each card, as soon as each is completely written.
        let messageId = '', askSent = false, cardsSent = 0
        stream.on('streamEvent', event => {
          if (event.type === 'message_start') messageId = event.message.id
          // Searching or reading the web happens inside the answer (on Anthropic's side): say so while it does.
          if (event.type === 'content_block_start' && event.content_block.type === 'server_tool_use') emit({ type: 'status', text: event.content_block.name === 'web_fetch' ? 'Reading their website…' : 'Checking the web…' })
        })
        stream.on('text', (_delta, snapshot) => {
          const reply = partialJsonString(snapshot, 'reply')
          if (reply !== null && reply !== shown) {
            emit(reply.startsWith(shown) ? { type: 'delta', text: reply.slice(shown.length) } : { type: 'reply', text: reply })
            shown = reply
          }
          if (!askSent) {
            const ask = finishedJsonObject<Ask>(snapshot, 'ask')
            if (ask) { askSent = true; const usable = usableAsk(ask); if (usable) emit({ type: 'ask', ask: usable }) }
          }
          const finished = finishedJsonItems<RawRecommendation>(snapshot, 'recommendations')
          for (; cardsSent < finished.length; cardsSent++) {
            const rec = finished[cardsSent], index = cardsSent, id = messageId, thisRound = round
            // Shown once Google says it isn't closed (cards from a round that started over are dropped).
            void check(rec).then(status => { if (status !== 'closed' && thisRound === liveRound) try { emit({ type: 'card', card: { ...card(current(rec, status), index, id), ...(typeof status === 'object' ? { placeId: status.placeId } : {}) } }) } catch { /* a malformed card waits for the final answer */ } })
          }
        })
        response = await stream.finalMessage()
        const calls = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
        // A long web search can pause the answer: send it back as it is to carry on.
        if (response.stop_reason === 'pause_turn' && round <= MAX_ROUNDS) { turns.push({ role: 'assistant', content: response.content }); continue }
        if (response.stop_reason !== 'tool_use' || !calls.length) break
        if (round > MAX_ROUNDS + 1) return emit({ type: 'error', error: 'Postcard took too long looking things up. Please try again.' })
        // Looking things up: anything shown so far starts over with the next round.
        if (shown) emit({ type: 'reply', text: '' })
        emit({ type: 'reset' })
        // Every kind of lookup in this round, e.g. "Checking opening hours… Working out travel times…".
        emit({ type: 'status', text: [...new Set(calls.map(call => STATUS[call.name] ?? 'Looking things up…'))].join(' ') })
        turns.push({ role: 'assistant', content: response.content })
        const results = await Promise.all(calls.map(async call => {
          lookups++
          const result = lookups > MAX_LOOKUPS ? { content: 'That’s enough lookups for this answer. Answer with what you have.', isError: true }
            : await runPlannerTool(call.name, call.input, { userId: owner, tripId: trip ? tripId : null, origin })
          if (result.isError) console.warn('[planner] tool error', call.name, result.content.slice(0, 300))
          return { type: 'tool_result' as const, tool_use_id: call.id, content: result.content, ...(result.isError ? { is_error: true } : {}) }
        }))
        console.info('[planner] lookups', JSON.stringify({ round, tools: calls.map(call => call.name), total: lookups, seconds: Math.round((Date.now() - started) / 1000) }))
        enough = round + 1 >= MAX_ROUNDS || lookups >= MAX_LOOKUPS || Date.now() - started > LOOKUP_SECONDS * 1000
        turns.push({ role: 'user', content: results })
      }

      if (response.stop_reason === 'refusal') return emit({ type: 'error', error: 'Postcard couldn’t answer that one. Try rephrasing.' })
      // The answer's text (web results can split it into several pieces).
      const text = response.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')
      let parsed: { reply: string; recommendations: RawRecommendation[]; title?: string; summary?: string; notes?: string; tripDates?: { start: string; end: string }; tripDays?: number; addToTrip?: boolean; ask?: Ask }
      try { parsed = JSON.parse(text ?? '') } catch { return emit({ type: 'error', error: 'The answer was cut off. Please try again.' }) }

      // Something to tap for the reply's question, kept only when it's usable.
      const ask = usableAsk(parsed.ask)
      // The trip's dates from the chat, when real and in order (a trip made from it starts with them).
      const day = /^\d{4}-\d{2}-\d{2}$/
      const tripDates = parsed.tripDates && day.test(parsed.tripDates.start) && day.test(parsed.tripDates.end) && parsed.tripDates.end >= parsed.tripDates.start ? { start: parsed.tripDates.start, end: parsed.tripDates.end } : null
      // Or just how many days, when they gave a length without dates (a trip made from it gets that many days).
      const tripDays = !tripDates && Number.isInteger(parsed.tripDays) && parsed.tripDays! >= 1 && parsed.tripDays! <= 365 ? parsed.tripDays! : null
      // Picks Google lists as closed are left out, and the reply says so.
      const statuses = await Promise.all(parsed.recommendations.map(rec => check(rec)))
      const closed = parsed.recommendations.filter((_, index) => statuses[index] === 'closed').map(rec => rec.name)
      // Renamed places go by their new name in the reply too (the card says what they used to be called).
      for (const [index, rec] of parsed.recommendations.entries()) {
        const status = statuses[index]
        if (typeof status === 'object') parsed.reply = parsed.reply.replace(new RegExp(rec.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), status.renamed)
      }
      if (closed.length) parsed.reply = `${parsed.reply}\n\n(I left out ${closed.join(', ')}: Google lists ${closed.length === 1 ? 'it' : 'them'} as closed.)`
      const recommendations = parsed.recommendations.map((rec, index) => { const status = statuses[index]; return { ...card(current(rec, status), index, response.id), ...(typeof status === 'object' ? { placeId: status.placeId } : {}) } }).filter((_, index) => statuses[index] !== 'closed')
      const nextHistory = [...history, ...turns, { role: 'assistant', content: response.content }] as unknown as Prisma.InputJsonValue
      const newTurns = [...(preferences ? [{ role: 'preferences', preferences }] : []), { role: 'user', text: message }, { role: 'assistant', text: parsed.reply, recommendations, ...(ask ? { ask } : {}), title: (parsed.title ?? '').trim().slice(0, 60), summary: (parsed.summary ?? '').trim().slice(0, 160), notes: (parsed.notes ?? '').trim().slice(0, 600), ...(tripDates ? { tripDates } : {}), ...(tripDays ? { tripDays } : {}), ...(closed.length ? { closed } : {}) }]
      // The turns as saved now (descriptions may have been added to earlier cards since this started).
      const latest = await prisma.planChat.findUnique({ where: { id: activeChatId }, select: { turns: true } })
      const saved = await prisma.planChat.update({ where: { id: activeChatId }, data: { history: nextHistory, turns: [...((latest?.turns ?? chat?.turns ?? []) as Prisma.JsonArray), ...newTurns] as Prisma.InputJsonValue, ...(trip && !chat?.tripId ? { tripId } : {}) }, select: { id: true } })
      emit({ type: 'done', chatId: saved.id, reply: parsed.reply, recommendations, ...(ask ? { ask } : {}), ...(tripDates ? { tripDates } : {}), ...(tripDays ? { tripDays } : {}), ...(parsed.addToTrip === true ? { addToTrip: true } : {}) })
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return emit({ type: 'error', error: 'Postcard is busy. Try again in a moment.' })
      if (error instanceof Anthropic.APIError) console.error('[testplan] Claude API error', error.status, error.message)
      else console.error('[testplan] chat failed', error)
      emit({ type: 'error', error: 'Postcard couldn’t answer right now. Please try again.' })
    }
  }
}

// The page coming back after losing the connection: the conversation's saved turns, to pick up an answer that
// finished while it was away.
export async function GET(request: Request) {
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('chat') ?? ''
  const chat = id ? await prisma.planChat.findFirst({ where: { id, userId }, select: { turns: true } }) : null
  if (!chat) return Response.json({ error: 'This conversation is no longer available.' }, { status: 404 })
  return Response.json({ turns: chat.turns }, { headers: { 'Cache-Control': 'private, no-store' } })
}
