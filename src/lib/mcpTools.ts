import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { actAs } from '@/lib/actingUser'
import { extractFromText, extractPrompt } from '@/lib/extractItinerary'
import { importedPlaces, type ImportedPlace } from '@/lib/planImport'
import { isDate } from '@/lib/placeDates'
import { startPlan } from '@/actions/planning'
import { importIntoPlan } from '@/actions/planImport'

// What an AI assistant can do with someone's Postcard account through the connector (api/mcp): read their trips,
// and start private plans or add places to them. Nothing here posts, deletes or messages anyone.
type Args = Record<string, unknown>
export type ToolResult = { text: string; error?: boolean }

const TYPES = ['hotel', 'food_drink', 'activity', 'transport']

export const TOOLS = [
  {
    name: 'list_trips',
    title: 'List my trips',
    description: 'Lists the trips in the person’s Postcard account, newest first: private plans they’re working on and trips they’ve posted, with dates, destinations and how many places each has.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_trip',
    title: 'Read a trip',
    description: 'Every place in one of the person’s trips (hotels, restaurants, things to do, transport), by destination, with its day, date and time, notes and rating. Use a trip_id from list_trips.',
    inputSchema: { type: 'object', properties: { trip_id: { type: 'string' } }, required: ['trip_id'], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'import_trip',
    title: 'Import a trip',
    description: 'Creates a new private plan in Postcard from a written trip summary: where they went or are going, dates, hotels, restaurants, activities and transport, in any format (notes, an itinerary, booking confirmations). Postcard finds the real places and puts dated ones on their days. Use one call per trip, e.g. for each of someone’s past trips. The plan stays private until they post it in the app.',
    inputSchema: { type: 'object', properties: {
      summary: { type: 'string', description: 'The trip in writing. Include the destination, dates if known, and every place with what it was (hotel, restaurant, activity), plus any notes.', maxLength: 20000 },
      title: { type: 'string', description: 'Optional trip name, e.g. "Paris, March 2025".', maxLength: 160 },
    }, required: ['summary'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'add_places',
    title: 'Add places to a plan',
    description: 'Adds places to one of the person’s private plans (not to posted trips). Places already in the plan aren’t added twice.',
    inputSchema: { type: 'object', properties: {
      trip_id: { type: 'string' },
      places: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', properties: {
        name: { type: 'string', maxLength: 240 },
        type: { type: 'string', enum: TYPES, description: 'hotel, food_drink (restaurants, cafés, bars), activity, or transport' },
        city: { type: 'string', description: 'The town or city it’s in', maxLength: 160 },
        country: { type: 'string', maxLength: 160 },
        notes: { type: 'string', maxLength: 4000 },
        day: { type: 'integer', minimum: 1, maximum: 365, description: 'Day of the trip, if known' },
      }, required: ['name', 'type', 'city'], additionalProperties: false } },
    }, required: ['trip_id', 'places'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
]

const day = (value: Date) => value.toISOString().slice(0, 10)
const str = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function callTool(name: string, args: Args, userId: string, origin: string): Promise<ToolResult> {
  if (name === 'list_trips') {
    const trips = await prisma.itinerary.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100, select: {
      id: true, title: true, visibility: true, datesFlexible: true, startDate: true, endDate: true, durationDays: true,
      destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, _count: { select: { items: true } } } } } })
    return { text: JSON.stringify(trips.map(trip => ({
      trip_id: trip.id, title: trip.title, status: trip.visibility === 'draft' ? 'private plan' : 'posted',
      dates: trip.datesFlexible ? null : { start: day(trip.startDate), end: day(trip.endDate) }, days: trip.durationDays,
      destinations: trip.destinations.filter(d => d.name !== 'Destination to decide').map(d => [d.name, d.country].filter(Boolean).join(', ')),
      places: trip.destinations.reduce((sum, d) => sum + d._count.items, 0), url: `${origin}/${trip.visibility === 'draft' ? 'plan' : 'itinerary'}/${trip.id}`,
    }))) }
  }

  if (name === 'get_trip') {
    const trip = await prisma.itinerary.findFirst({ where: { id: str(args.trip_id, 60), userId }, select: {
      id: true, title: true, visibility: true, datesFlexible: true, startDate: true, endDate: true, durationDays: true,
      destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: [{ dayIndex: 'asc' }, { order: 'asc' }], select: {
        name: true, type: true, dayIndex: true, date: true, time: true, nights: true, notes: true, rating: true, address: true, tags: true } } } } } })
    if (!trip) return { text: 'No trip with that id in this account. Use list_trips to find it.', error: true }
    return { text: JSON.stringify({
      trip_id: trip.id, title: trip.title, status: trip.visibility === 'draft' ? 'private plan' : 'posted',
      dates: trip.datesFlexible ? null : { start: day(trip.startDate), end: day(trip.endDate) }, days: trip.durationDays,
      destinations: trip.destinations.filter(d => d.items.length || d.name !== 'Destination to decide').map(d => ({ name: [d.name, d.country].filter(Boolean).join(', '),
        places: d.items.filter(item => !item.tags.includes('__option')).map(item => ({ name: item.name, type: item.type, day: item.dayIndex, date: item.date ? day(item.date) : null,
          time: item.time, nights: item.nights, notes: item.notes, rating: item.rating, address: item.address })) })),
      url: `${origin}/${trip.visibility === 'draft' ? 'plan' : 'itinerary'}/${trip.id}`,
    }) }
  }

  if (name === 'import_trip') {
    const summary = str(args.summary, 20000)
    if (summary.length < 10) return { text: 'Send the trip as a written summary: where, when, and the places.', error: true }
    const extracted = await extractFromText(summary, extractPrompt(true, []))
    const places = importedPlaces(extracted).slice(0, 200)
    if (!places.length) return { text: 'No places found in that summary. Include the hotels, restaurants or things to do, and the town each is in.', error: true }
    const title = str(args.title, 160) || str(extracted.title, 160) || `Trip to ${places[0].destination}`
    const dated = isDate(extracted.startDate) && isDate(extracted.endDate) && extracted.endDate >= extracted.startDate
    const form = new FormData()
    for (const [key, value] of Object.entries({ clientId: randomUUID(), title, destination: '', audience: 'family', format: 'auto', startDate: dated ? extracted.startDate! : '', endDate: dated ? extracted.endDate! : '' })) form.set(key, value)
    const started = await actAs(userId, () => startPlan(form))
    if (!started.id) return { text: started.error ?? 'Could not start the plan.', error: true }
    const imported = await actAs(userId, () => importIntoPlan(started.id!, randomUUID(), places))
    if (imported.error) return { text: imported.error, error: true }
    return { text: JSON.stringify({ trip_id: started.id, title, places: places.length, status: 'private plan', url: `${origin}/plan/${started.id}`,
      message: `Created the private plan “${title}” with ${places.length} ${places.length === 1 ? 'place' : 'places'}.` }) }
  }

  if (name === 'add_places') {
    const tripId = str(args.trip_id, 60)
    const plan = await prisma.itinerary.findFirst({ where: { id: tripId, userId }, select: { visibility: true } })
    if (!plan) return { text: 'No trip with that id in this account. Use list_trips to find it.', error: true }
    if (plan.visibility !== 'draft') return { text: 'That trip is posted. Places can only be added to private plans; edit posted trips in the app.', error: true }
    const list = Array.isArray(args.places) ? args.places.slice(0, 50) as Args[] : []
    const places: ImportedPlace[] = list.filter(place => str(place.name, 240) && TYPES.includes(String(place.type)) && str(place.city, 160)).map(place => ({
      name: str(place.name, 240), type: String(place.type), destination: str(place.city, 160), country: str(place.country, 160), notes: str(place.notes, 4000),
      day: Number.isInteger(place.day) && Number(place.day) >= 1 && Number(place.day) <= 365 ? Number(place.day) : null,
      rating: null, mealType: '', date: null, time: null, endDate: null, endTime: null, nights: null }))
    if (!places.length) return { text: 'Each place needs a name, a type (hotel, food_drink, activity or transport) and its city.', error: true }
    const result = await actAs(userId, () => importIntoPlan(tripId, randomUUID(), places))
    if (result.error) return { text: result.error, error: true }
    return { text: JSON.stringify({ trip_id: tripId, added: places.length, url: `${origin}/plan/${tripId}`, message: `Added ${places.length} ${places.length === 1 ? 'place' : 'places'} (any already in the plan were merged, not repeated).` }) }
  }

  return { text: `Unknown tool: ${name}`, error: true }
}
