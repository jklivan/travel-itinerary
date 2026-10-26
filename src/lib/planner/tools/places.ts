import { prisma } from '@/lib/prisma'
import { hiddenAccountsFor } from '@/lib/hiddenAccounts'
import { withoutPrivateTransport } from '@/lib/privateTransport'
import { distanceMiles } from '@/lib/distance'
import { searchPlaces, placeDetails, travelTime, type Mode } from '../google'
import { openAt, hoursOn, dayName } from '../hours'
import { fail, hhmm, int, isoDate, ok, text, type PlannerTool } from '../types'

const TYPES = ['hotel', 'food_drink', 'activity', 'transport']

// The places the traveler's friends (people they follow) posted for a destination: Postcard's own knowledge.
export const friendsPlaces: PlannerTool = {
  name: 'friends_places',
  description: 'Places the traveler’s friends (people they follow) have been to and posted for a destination, with their rating, notes and which trip. Use this first for any destination: friends’ picks are what makes Postcard’s suggestions personal.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['destination'], properties: {
    destination: { type: 'string', description: 'Town, region or country, e.g. "Lisbon" or "Amalfi Coast".' },
    type: { type: 'string', enum: TYPES, description: 'Only hotels, food_drink, activity or transport.' },
    min_rating: { type: 'integer', minimum: 1, maximum: 5, description: 'Only places the friend rated at least this.' },
  } },
  async run(input, { userId }) {
    const destination = text(input.destination, 120)
    if (!destination) return fail('Name a destination.')
    const type = TYPES.includes(String(input.type)) ? String(input.type) : undefined
    const minRating = int(input.min_rating, 1, 5)
    const where = { contains: destination, mode: 'insensitive' as const }
    const trips = await prisma.itinerary.findMany({ where: { visibility: 'public', userId: { notIn: [userId, ...hiddenAccountsFor(userId)] }, user: { followers: { some: { followerId: userId, status: 'accepted' } } },
      destinations: { some: { OR: [{ name: where }, { country: where }] } } }, take: 40, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, user: { select: { name: true } }, destinations: { where: { OR: [{ name: where }, { country: where }] }, select: { name: true, country: true, items: { select: { name: true, type: true, rating: true, notes: true, tags: true, placeId: true } } } } } })
    const places = trips.flatMap(trip => trip.destinations.flatMap(stop => withoutPrivateTransport(stop.items)
      .filter(item => (!type || item.type === type) && (!minRating || (item.rating ?? 0) >= minRating) && !item.tags.includes('__option'))
      .map(item => ({ name: item.name, type: item.type, rating: item.rating, notes: item.notes?.slice(0, 300) || undefined, where: [stop.name, stop.country].filter(Boolean).join(', '), friend: trip.user.name, trip: trip.title, place_id: item.placeId ?? undefined }))))
    return ok(places.length ? { count: places.length, places: places.slice(0, 60) } : `None of the traveler’s friends have posted places for ${destination} yet.`)
  },
}

export const searchPlacesTool: PlannerTool = {
  name: 'search_places',
  description: 'Search Google for real places (hotels, restaurants, sights, tours) by description and area, e.g. "family-friendly seafood restaurant in Cascais". Returns name, address, rating, price level, whether it is operating, and a place_id for place_details, opening_hours and travel_time.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['query'], properties: {
    query: { type: 'string', description: 'What and where, e.g. "rooftop bar Lisbon".' },
    limit: { type: 'integer', minimum: 1, maximum: 10 },
  } },
  async run(input, { signal }) {
    const query = text(input.query, 200)
    if (!query) return fail('Say what to search for.')
    const places = await searchPlaces(query, undefined, int(input.limit, 1, 10) ?? 6, signal)
    return ok(places.map(place => ({ place_id: place.id, name: place.name, address: place.address, rating: place.rating, ratings: place.ratings, price: place.priceLevel, status: place.status, types: place.types })))
  },
}

export const placeDetailsTool: PlannerTool = {
  name: 'place_details',
  description: 'Everything about one place: address, website, phone, rating, price level, a short description, its weekly opening hours, and whether it is still operating.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['place_id'], properties: { place_id: { type: 'string', description: 'From search_places or friends_places.' } } },
  async run(input, { signal }) {
    const id = text(input.place_id, 300)
    if (!id) return fail('Give a place_id.')
    const place = await placeDetails(id, signal)
    return ok({ name: place.name, address: place.address, website: place.website, phone: place.phone, rating: place.rating, ratings: place.ratings, price: place.priceLevel, status: place.status, about: place.summary, hours: place.weekdayHours, maps: place.mapsUrl })
  },
}

export const openingHoursTool: PlannerTool = {
  name: 'opening_hours',
  description: 'Whether a place is open on a specific date (and time, if given), with that day’s hours. Use it before putting a restaurant or sight on a day. Holiday hours are only known about a week ahead; further out it uses the regular weekly hours.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['place_id', 'date'], properties: {
    place_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM, 24-hour, the place’s local time.' },
  } },
  async run(input, { signal }) {
    const id = text(input.place_id, 300), date = isoDate(input.date), time = input.time === undefined ? null : hhmm(input.time)
    if (!id || !date) return fail('Give a place_id and a date (YYYY-MM-DD).')
    if (input.time !== undefined && !time) return fail('Give the time as HH:MM, 24-hour.')
    const place = await placeDetails(id, signal)
    if (place.status && place.status !== 'OPERATIONAL') return ok({ name: place.name, open: false, note: place.status === 'CLOSED_PERMANENTLY' ? 'Closed permanently.' : 'Closed for now.' })
    // Holiday hours for the coming week replace the regular ones on those dates.
    const special = place.specialDays?.some(day => day.date === date)
    const periods = special ? place.currentPeriods : place.periods
    if (!periods?.length) return ok({ name: place.name, open: 'unknown', note: 'Google has no opening hours for this place.' })
    const hours = hoursOn(periods, date)
    return ok({ name: place.name, date, day: dayName(date), hours: hours ?? 'Closed', ...(time ? { at: time, open: openAt(periods, date, time) } : { open: !!hours }), ...(special ? { note: 'Special (holiday) hours that day.' } : {}) })
  },
}

export const travelTimeTool: PlannerTool = {
  name: 'travel_time',
  description: 'How long it takes to get between two places by car, on foot, by public transit or by bike, and how far. Use it to keep each day realistic. Places can be given by place_id or by name and town.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: {
    from: { type: 'object', properties: { place_id: { type: 'string' }, address: { type: 'string' } } },
    to: { type: 'object', properties: { place_id: { type: 'string' }, address: { type: 'string' } } },
    mode: { type: 'string', enum: ['drive', 'walk', 'transit', 'bicycle'] },
    departure: { type: 'string', description: 'When leaving, ISO date-time with timezone, for traffic and transit times (optional).' },
  } },
  async run(input, { signal }) {
    const stop = (value: unknown) => { const v = (value ?? {}) as Record<string, unknown>; return { placeId: text(v.place_id, 300) || undefined, address: text(v.address, 200) || undefined } }
    const from = stop(input.from), to = stop(input.to)
    if (!(from.placeId || from.address) || !(to.placeId || to.address)) return fail('Give where from and where to (place_id or address).')
    const mode = ({ drive: 'DRIVE', walk: 'WALK', transit: 'TRANSIT', bicycle: 'BICYCLE' } as Record<string, Mode>)[String(input.mode ?? 'drive')] ?? 'DRIVE'
    const departure = typeof input.departure === 'string' && !Number.isNaN(Date.parse(input.departure)) ? new Date(input.departure).toISOString() : undefined
    try {
      const route = await travelTime(from, to, mode, departure, signal)
      return route ? ok({ mode: mode.toLowerCase(), minutes: route.minutes, km: route.km, text: route.text }) : fail('No route found between those places.')
    } catch (error) {
      // Routes not available (not switched on for the key): a straight-line estimate from the places' positions,
      // found by Google id or by searching the written address.
      const position = async (stop: { placeId?: string; address?: string }) => stop.placeId ? (await placeDetails(stop.placeId, signal)).location : (await searchPlaces(stop.address!, undefined, 1, signal))[0]?.location
      const [a, b] = await Promise.all([position(from), position(to)]).catch(() => [undefined, undefined])
      if (!a || !b) throw error
      const miles = distanceMiles(a, b), speed = { DRIVE: 25, WALK: 3, TRANSIT: 15, BICYCLE: 9 }[mode]
      return ok({ mode: mode.toLowerCase(), estimate: true, minutes: Math.round(miles * 1.3 / speed * 60), km: Math.round(miles * 1.609 * 10) / 10, note: 'Rough estimate from straight-line distance.' })
    }
  },
}
