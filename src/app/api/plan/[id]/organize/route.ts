import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/tripAccess'
import { placeDetails } from '@/lib/planner/google'
import { hoursOn, dayName } from '@/lib/planner/hours'
import { distanceMiles } from '@/lib/distance'
import { applyDayPlan } from '@/actions/planning'

export const maxDuration = 300

const client = new Anthropic()
const INSTRUCTIONS = `You are Postcard's trip planner, inside Postcard, a travel app. If you refer to yourself, you are Postcard, not Claude.
The traveler has a day-by-day trip with some places already on days and some unscheduled. Suggest which day each unscheduled place should go on.
How to arrange:
- Group places that are near each other on the same day (use the coordinates when given, otherwise what you know about where the place is), so each day is easy to get around.
- Give each day a sensible mix: a few things to do and places to eat for different meals, not five restaurants on one day. Respect meal types (breakfast, lunch, dinner) when given.
- Don't overload a day; spread places across all the days when there's enough to do.
- Keep the places already on days where they are, and fit the unscheduled places around them (unless asked to re-plan the whole trip: then arrange every place from scratch).
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
type Plan = { assignments: { id: string; day: number }[]; days: { day: number; theme: string; why: string }[] }
type Place = { id: string; name: string; type: string; placeId: string | null; lat: number | null; lng: number | null; day: number | null }

// Places further apart than this (straight line) make a day hard to get around.
const FAR_MILES = 25
// More than this many things to do and places to eat (hotels and transport aside) is an overfull day.
const BUSY_DAY = 6
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10)

// Checks a proposed plan against the real world: a place closed on its day (Google's opening hours, for dated trips),
// places on one day too far apart, and overfull days. Returns what's wrong (for the AI to fix) and what was checked.
async function checkPlan(plan: Plan, places: Place[], start: string | null) {
  const dayOf = new Map(places.map(place => [place.id, place.day]))
  for (const assignment of plan.assignments) dayOf.set(assignment.id, assignment.day)
  const onDay = (day: number) => places.filter(place => dayOf.get(place.id) === day)
  const used = [...new Set([...dayOf.values()].filter((day): day is number => !!day && day > 0))].sort((a, b) => a - b)
  const problems: string[] = [], checked: string[] = []
  // Opening hours: dated trips only, places Google knows, not hotels or transport.
  if (start) {
    const toCheck = used.flatMap(day => onDay(day).filter(place => place.placeId && place.type !== 'hotel' && place.type !== 'transport').map(place => ({ place, day, date: addDays(start, day - 1) }))).slice(0, 30)
    const signal = AbortSignal.timeout(20_000)
    const results = await Promise.all(toCheck.map(async ({ place, day, date }) => {
      try {
        const details = await placeDetails(place.placeId!, signal)
        if (details.status && details.status !== 'OPERATIONAL') return `${place.name} (day ${day}) is ${details.status === 'CLOSED_PERMANENTLY' ? 'closed permanently' : 'closed for now'}: leave it unscheduled (day 0).`
        if (!details.periods?.length) return null
        return hoursOn(details.periods, date) ? null : `${place.name} is closed on ${dayName(date)}s, so not on day ${day} (${date}).`
      } catch { return null }
    }))
    problems.push(...results.filter((problem): problem is string => !!problem))
    if (toCheck.length) checked.push(`Opening hours on each day (${toCheck.length} place${toCheck.length === 1 ? '' : 's'})`)
  }
  for (const day of used) {
    const here = onDay(day)
    const located = here.filter(place => place.lat != null && place.lng != null && place.type !== 'transport')
    let far: [Place, Place, number] | null = null
    for (const [index, a] of located.entries()) for (const b of located.slice(index + 1)) {
      const miles = distanceMiles({ lat: a.lat!, lng: a.lng! }, { lat: b.lat!, lng: b.lng! })
      if (miles > FAR_MILES && (!far || miles > far[2])) far = [a, b, miles]
    }
    if (far) problems.push(`Day ${day} has ${far[0].name} and ${far[1].name} about ${Math.round(far[2])} miles apart: put far-apart places on different days.`)
    const busy = here.filter(place => place.type !== 'hotel' && place.type !== 'transport').length
    if (busy > BUSY_DAY) problems.push(`Day ${day} has ${busy} places: spread some to quieter days.`)
  }
  checked.push('Distances within each day', 'How full each day is')
  return { problems, checked }
}

// "Plan my days with AI" on the planner's Itinerary tab: proposes a day for each unscheduled place, or with
// { replan: true } ("Re-plan my days") for every place. Nothing is saved here; the traveler reviews and applies it.
// Picks added from the AI chat ({ apply: true, guide }) go straight onto days, following the day-by-day plan the chat
// gave (`guide`, its recent answers), and can be moved afterwards.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'AI isn’t set up yet.' }, { status: 500 })
  const trip = await prisma.itinerary.findFirst({ where: { id, ...canEdit(userId) }, select: { title: true, durationDays: true, startDate: true, datesFlexible: true, destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: { id: true, name: true, type: true, mealType: true, notes: true, dayIndex: true, lat: true, lng: true, tags: true, placeId: true } } } } } })
  if (!trip) return Response.json({ error: 'This trip is unavailable.' }, { status: 404 })
  const days = trip.durationDays
  if (!days) return Response.json({ error: 'Set how many days your trip is first.' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const replan = body?.replan === true
  const apply = body?.apply === true && !replan
  const guide = typeof body?.guide === 'string' ? body.guide.slice(-8000).trim() : ''
  const lines: string[] = []
  const unscheduled = new Set<string>()
  const places: Place[] = []
  for (const destination of trip.destinations) {
    const offset = destination.items.some(item => item.type !== 'hotel' && item.dayIndex === 0) ? 1 : 0
    for (const item of destination.items) {
      // Backup places ("Save as alternative") aren't part of the plan.
      if (item.tags.includes('__option')) continue
      const day = item.dayIndex === null ? null : item.dayIndex + offset
      if (day === null || replan) unscheduled.add(item.id)
      places.push({ id: item.id, name: item.name, type: item.type, placeId: item.placeId, lat: item.lat, lng: item.lng, day: replan ? null : day })
      const where = [destination.name, destination.country].filter(Boolean).join(', ')
      const coords = item.lat != null && item.lng != null ? ` @${item.lat.toFixed(4)},${item.lng.toFixed(4)}` : ''
      const meal = item.mealType ? `, ${item.mealType}` : ''
      const note = item.notes ? ` — note: ${item.notes.slice(0, 200).replace(/\s+/g, ' ')}` : ''
      lines.push(`[${item.id}] ${item.name} (${item.type}${meal}, ${where})${coords} ${day === null ? 'UNSCHEDULED' : `day ${day}`}${note}`)
    }
  }
  if (!unscheduled.size) return Response.json({ error: replan ? 'Add some places first.' : 'Every place already has a day.' }, { status: 400 })

  // The trip's first day, when it has real dates: opening hours are checked on each day's date.
  const start = trip.datesFlexible ? null : trip.startDate.toISOString().slice(0, 10)
  // The chat's own plan, as data: which places it put on which day.
  const chatPlan = guide ? `<chat_plan>\n${guide.replace(/<\/?chat_plan>/g, '')}\n</chat_plan>\n\nThe traveler planned this trip in a chat with Postcard (above). Where that chat put a place on a particular day, use that day; arrange the rest as usual.\n\n` : ''
  const ask = `${chatPlan}<trip title="${trip.title.replace(/"/g, "'")}" days="${days}"${start ? ` starts="${start}"` : ''}>\n${lines.join('\n')}\n</trip>\n\n${replan ? `Re-plan the whole trip: arrange every place into days 1 to ${days} from scratch, ignoring their current days, and return every place.` : `Arrange the unscheduled places into days 1 to ${days}.`}`
  // Only this trip's unscheduled places, on real days; anything else stays unscheduled.
  const tidy = (parsed: Plan): Plan => {
    const seen = new Set<string>()
    return {
      assignments: parsed.assignments.filter(assignment => unscheduled.has(assignment.id) && !seen.has(assignment.id) && seen.add(assignment.id) && Number.isInteger(assignment.day) && assignment.day >= 1 && assignment.day <= days),
      days: parsed.days.filter(day => Number.isInteger(day.day) && day.day >= 1 && day.day <= days).map(day => ({ day: day.day, theme: day.theme.slice(0, 80), why: day.why.slice(0, 300) })),
    }
  }
  const run = (messages: Anthropic.MessageParam[]) => client.messages.create({ model: 'claude-opus-5-5', max_tokens: 8000, output_config: { effort: 'low', format: { type: 'json_schema', schema } }, system: INSTRUCTIONS, messages })
  const read = (response: Anthropic.Message): Plan | null => { try { return JSON.parse(response.content.find(block => block.type === 'text')?.text ?? '') } catch { return null } }

  try {
    const first = await run([{ role: 'user', content: ask }])
    if (first.stop_reason === 'refusal') return Response.json({ error: 'Postcard couldn’t organize this trip. Try again.' }, { status: 422 })
    const draft = read(first)
    if (!draft) return Response.json({ error: 'The plan was cut off. Please try again.' }, { status: 502 })
    let plan = tidy(draft)
    // Check it against opening hours, distances and how full each day is; one chance to fix what's wrong.
    const review = await checkPlan(plan, places, start).catch(() => ({ problems: [] as string[], checked: [] as string[] }))
    let fixed = 0
    if (review.problems.length) {
      console.info('[organize] fixing', JSON.stringify({ trip: id, problems: review.problems.length }))
      const second = await run([{ role: 'user', content: ask }, { role: 'assistant', content: first.content }, { role: 'user', content: `I checked your plan and found:\n${review.problems.map(problem => `- ${problem}`).join('\n')}\n\nFix these by moving places to other days (day 0 if nothing fits), keeping the rest as it is, and return the whole plan again.` }]).catch(() => null)
      const better = second && second.stop_reason !== 'refusal' ? read(second) : null
      if (better) { plan = tidy(better); fixed = review.problems.length }
    }
    if (apply) {
      const result = plan.assignments.length ? await applyDayPlan(id, plan.assignments) : {}
      if (result.error) return Response.json({ error: result.error }, { status: 500 })
      return Response.json({ applied: plan.assignments.length })
    }
    return Response.json({ ...plan, checked: review.checked, fixed })
  } catch {
    return Response.json({ error: 'Postcard couldn’t organize this trip right now. Please try again.' }, { status: 502 })
  }
}
