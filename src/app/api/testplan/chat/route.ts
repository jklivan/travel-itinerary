import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { loadPlanningContext } from '@/lib/testplanContext'
import { cleanPreferences, describePreferences } from '@/lib/travelPreferences'
import type { Prisma } from '@/generated/prisma/client'

export const maxDuration = 300

const client = new Anthropic()

const INSTRUCTIONS = `You are Postcard's trip planner, inside Postcard, a travel app where friends share the places they've been. If you refer to yourself, you are Postcard, not Claude.
You're helping the user plan a new trip. Below is everything they and their friends have logged: trips, places, star ratings (1-5) and personal notes.

How to help:
- Lead with what their friends (and the user themselves) actually loved. Name the friend, and quote or paraphrase their note when it helps. High ratings and enthusiastic notes are the strongest signal; low ratings are warnings worth mentioning.
- Always mix in new places that are not in the travel data, marked as source "claude" — even when friends have logged plenty. For every destination you suggest, include at least one place to stay, two things to do and two places to eat that nobody in the data has been to, alongside the friends' picks. When the data has little or nothing for a destination, say so plainly and make the whole suggestion from your own picks.
- Only recommend real, specific places (a named hotel, restaurant, sight), not generic advice. Keep "why" to one or two sentences.
- Don't re-recommend places already in the user's current trip.
- Keep the reply conversational and brief (a few short paragraphs at most). The recommendations list renders as cards next to your reply, so don't repeat every detail in the reply text.
- Whenever you suggest trip ideas, at least one must be a whole destination that nobody in the travel data has been to, so the user discovers somewhere new — even when friends' trips would fill the list. Name it as its own trip idea and make its places your own picks. The exception is when the user asks about one specific place (e.g. "what should we do in Lisbon?"): then stay in that place.
- When you suggest a destination, cover it as a whole trip: a place or two to stay, a few things to do, and a few places to eat. When you offer alternative destinations, do this for each one.
- Before recommending places, you need to know: what kind of trip this is now (who's going, how long), their budget, the types of destination they like, and what they like to do. Use <traveler_preferences> when present. When the user has past trips of their own, infer budget, destination types and activities from those trips (budgets, ratings, tags, places) instead of asking. If the user has no past trips and hasn't shared preferences, don't recommend yet: reply with one short, friendly question asking for what's missing, and return an empty recommendations list.
- Recommendations are optional: return an empty list when the user is just chatting or asking a question that doesn't call for places.

For each recommendation:
- source "friend" = from a friend's trip, "you" = from the user's own past trip, "claude" = your own suggestion.
- sourceItemId = the bracketed id of the place in the data below when source is "friend" or "you"; otherwise "".
- friendName = the friend's name when source is "friend"; otherwise "".
- destination = the city or area; country = the country.
- description = 2-3 sentences describing the place itself (what it is, what it's like, what to order or see). This is separate from "why", which says why it suits this user.
- tripOption = a short name (2-4 words) for the trip idea this place belongs to, e.g. "Amalfi Coast" or "Greek islands". When you suggest alternative trips, give each its own name and use exactly the same name for every place in it. Reuse a name from earlier in the conversation when adding to that idea.`

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'recommendations'],
  properties: {
    reply: { type: 'string' },
    recommendations: { type: 'array', items: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'type', 'destination', 'country', 'tripOption', 'description', 'why', 'source', 'sourceItemId', 'friendName'],
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['hotel', 'food_drink', 'activity'] },
        destination: { type: 'string' },
        country: { type: 'string' },
        tripOption: { type: 'string' },
        description: { type: 'string' },
        why: { type: 'string' },
        source: { type: 'string', enum: ['friend', 'you', 'claude'] },
        sourceItemId: { type: 'string' },
        friendName: { type: 'string' },
      },
    } },
  },
}

type RawRecommendation = { name: string; type: 'hotel' | 'food_drink' | 'activity'; destination: string; country: string; tripOption: string; description: string; why: string; source: 'friend' | 'you' | 'claude'; sourceItemId: string; friendName: string }

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
    tripId ? prisma.itinerary.findFirst({ where: { id: tripId, userId }, select: { title: true, destinations: { select: { name: true, items: { select: { name: true, type: true, dayIndex: true } } } } } }) : null,
  ])
  const current = trip
    ? `<current_trip title="${trip.title}">\n${trip.destinations.flatMap(d => d.items.map(item => `- ${item.name} (${item.type}, ${d.name}${item.dayIndex === null ? '' : `, day ${item.dayIndex}`})`)).join('\n') || '(empty so far)'}\n</current_trip>`
    : '<current_trip>Not started yet. Adding a recommendation will create it.</current_trip>'
  // The setup answers ride along with the first message, so they stay in the conversation history.
  const preferences = cleanPreferences(body?.preferences)
  const traveler = `<traveler past_trips="${context.hasOwnTrips ? 'yes' : 'none'}" />`
  const preferencesBlock = preferences ? `\n<traveler_preferences>\n${describePreferences(preferences)}\n</traveler_preferences>` : ''
  const userMessage: Anthropic.MessageParam = { role: 'user', content: `${current}\n${traveler}${preferencesBlock}\n\n${message}` }

  try {
    const response = await client.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 32000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      cache_control: { type: 'ephemeral' },
      system: [
        { type: 'text', text: INSTRUCTIONS },
        { type: 'text', text: `<travel_data>\n${context.text}\n</travel_data>`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [...history, userMessage],
    }).finalMessage()

    if (response.stop_reason === 'refusal') return Response.json({ error: 'Postcard couldn’t answer that one. Try rephrasing.' }, { status: 422 })
    const text = response.content.find(block => block.type === 'text')?.text
    let parsed: { reply: string; recommendations: RawRecommendation[] }
    try { parsed = JSON.parse(text ?? '') } catch { return Response.json({ error: 'The answer was cut off. Please try again.' }, { status: 502 }) }

    const recommendations = parsed.recommendations.map((rec, index) => {
      const source = context.items.get(rec.sourceItemId)
      return {
        key: `${response.id}:${index}`, name: rec.name, type: rec.type, why: rec.why, tripOption: rec.tripOption.trim(), description: rec.description.trim(),
        destination: source?.destination ?? rec.destination, country: source?.country ?? (rec.country || null),
        source: source ? (source.mine ? 'you' : 'friend') : 'claude' as const,
        friendName: source && !source.mine ? source.owner : '',
        sourceItemId: source?.id ?? '', placeId: source?.placeId ?? null, lat: source?.lat ?? null, lng: source?.lng ?? null,
      }
    })
    const nextHistory = [...history, userMessage, { role: 'assistant', content: response.content }] as unknown as Prisma.InputJsonValue
    const newTurns = [...(preferences ? [{ role: 'preferences', preferences }] : []), { role: 'user', text: message }, { role: 'assistant', text: parsed.reply, recommendations }]
    const saved = chat
      ? await prisma.planChat.update({ where: { id: chat.id }, data: { history: nextHistory, turns: [...(chat.turns as Prisma.JsonArray), ...newTurns] as Prisma.InputJsonValue, ...(trip && !chat.tripId ? { tripId } : {}) }, select: { id: true } })
      : await prisma.planChat.create({ data: { userId, tripId: trip ? tripId : null, history: nextHistory, turns: newTurns as Prisma.InputJsonValue }, select: { id: true } })
    return Response.json({ chatId: saved.id, reply: parsed.reply, recommendations })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: 'Postcard is busy. Try again in a moment.' }, { status: 429 })
    if (error instanceof Anthropic.APIError) { console.error('[testplan] Claude API error', error.status, error.message); return Response.json({ error: 'Postcard couldn’t answer right now. Please try again.' }, { status: 502 }) }
    throw error
  }
}
