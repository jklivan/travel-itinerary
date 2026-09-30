import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 120

const client = new Anthropic()
const INSTRUCTIONS = `You are Postcard's trip planner, inside Postcard, a travel app. If you refer to yourself, you are Postcard, not Claude.
The traveler has a day-by-day trip with some places already on days and some unscheduled. Suggest which day each unscheduled place should go on.
How to arrange:
- Group places that are near each other on the same day (use the coordinates when given, otherwise what you know about where the place is), so each day is easy to get around.
- Give each day a sensible mix: a few things to do and places to eat for different meals, not five restaurants on one day. Respect meal types (breakfast, lunch, dinner) when given.
- Don't overload a day; spread places across all the days when there's enough to do.
- Keep the places already on days where they are, and fit the unscheduled places around them.
- Hotels: put a hotel on the first day the traveler would stay there. Transport: put it on the day it's most likely used, or leave it unscheduled (day 0) if unclear.
- Leave a place unscheduled (day 0) only when there is genuinely no good fit.
Return every unscheduled place exactly once, by its id. For each day you use, give a short theme (3-6 words, e.g. "Old town and waterfront") and one sentence on why.`
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['assignments', 'days'],
  properties: {
    assignments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'day'], properties: { id: { type: 'string' }, day: { type: 'integer' } } } },
    days: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['day', 'theme', 'why'], properties: { day: { type: 'integer' }, theme: { type: 'string' }, why: { type: 'string' } } } },
  },
}

// "Organize with AI" on the planner's Itinerary tab: proposes a day for each unscheduled place.
// Nothing is saved here; the traveler reviews the plan and applies it.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'AI isn’t set up yet.' }, { status: 500 })
  const trip = await prisma.itinerary.findFirst({ where: { id, userId }, select: { title: true, durationDays: true, destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: { id: true, name: true, type: true, mealType: true, notes: true, dayIndex: true, lat: true, lng: true, tags: true } } } } } })
  if (!trip) return Response.json({ error: 'This trip is unavailable.' }, { status: 404 })
  const days = trip.durationDays
  if (!days) return Response.json({ error: 'Set how many days your trip is first.' }, { status: 400 })
  const lines: string[] = []
  const unscheduled = new Set<string>()
  for (const destination of trip.destinations) {
    const offset = destination.items.some(item => item.type !== 'hotel' && item.dayIndex === 0) ? 1 : 0
    for (const item of destination.items) {
      // Backup places ("Save as alternative") aren't part of the plan.
      if (item.tags.includes('__option')) continue
      const day = item.dayIndex === null ? null : item.dayIndex + offset
      if (day === null) unscheduled.add(item.id)
      const where = [destination.name, destination.country].filter(Boolean).join(', ')
      const coords = item.lat != null && item.lng != null ? ` @${item.lat.toFixed(4)},${item.lng.toFixed(4)}` : ''
      const meal = item.mealType ? `, ${item.mealType}` : ''
      const note = item.notes ? ` — note: ${item.notes.slice(0, 200).replace(/\s+/g, ' ')}` : ''
      lines.push(`[${item.id}] ${item.name} (${item.type}${meal}, ${where})${coords} ${day === null ? 'UNSCHEDULED' : `day ${day}`}${note}`)
    }
  }
  if (!unscheduled.size) return Response.json({ error: 'Every place already has a day.' }, { status: 400 })

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system: INSTRUCTIONS,
      messages: [{ role: 'user', content: `<trip title="${trip.title.replace(/"/g, "'")}" days="${days}">\n${lines.join('\n')}\n</trip>\n\nArrange the unscheduled places into days 1 to ${days}.` }],
    })
    if (response.stop_reason === 'refusal') return Response.json({ error: 'Postcard couldn’t organize this trip. Try again.' }, { status: 422 })
    const text = response.content.find(block => block.type === 'text')?.text
    let parsed: { assignments: { id: string; day: number }[]; days: { day: number; theme: string; why: string }[] }
    try { parsed = JSON.parse(text ?? '') } catch { return Response.json({ error: 'The plan was cut off. Please try again.' }, { status: 502 }) }
    // Only this trip's unscheduled places, on real days; anything else stays unscheduled.
    const seen = new Set<string>()
    const assignments = parsed.assignments.filter(assignment => unscheduled.has(assignment.id) && !seen.has(assignment.id) && seen.add(assignment.id) && Number.isInteger(assignment.day) && assignment.day >= 1 && assignment.day <= days)
    const themes = parsed.days.filter(day => Number.isInteger(day.day) && day.day >= 1 && day.day <= days).map(day => ({ day: day.day, theme: day.theme.slice(0, 80), why: day.why.slice(0, 300) }))
    return Response.json({ assignments, days: themes })
  } catch {
    return Response.json({ error: 'Postcard couldn’t organize this trip right now. Please try again.' }, { status: 502 })
  }
}
