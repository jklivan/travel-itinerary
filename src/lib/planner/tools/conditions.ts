import { runHotelPrices, hotelPricesTool } from '@/lib/hotelPrices'
import { fail, isoDate, ok, text, type PlannerTool } from '../types'

// Weather (Open-Meteo, free, no key), local events (Ticketmaster), tours and tickets (Viator), hotel prices (LiteAPI).
// A tool whose service has no key yet says so, rather than failing the whole answer.

type Spot = { name: string; country?: string; lat: number; lng: number; timezone?: string }
async function locate(place: string, signal?: AbortSignal): Promise<Spot | null> {
  const [name, ...rest] = place.split(',').map(part => part.trim())
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=${encodeURIComponent(name)}`, { signal: signal ?? AbortSignal.timeout(8000) })
  if (!response.ok) return null
  const results = ((await response.json()) as { results?: { name: string; country?: string; admin1?: string; latitude: number; longitude: number; timezone?: string }[] }).results ?? []
  // "Portland, Maine": prefer the match whose region or country names the rest.
  const hint = rest.join(' ').toLowerCase()
  const best = (hint && results.find(r => `${r.admin1 ?? ''} ${r.country ?? ''}`.toLowerCase().includes(hint))) || results[0]
  return best ? { name: best.name, country: best.country, lat: best.latitude, lng: best.longitude, timezone: best.timezone } : null
}
const shift = (date: string, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`
const f = (celsius: number) => Math.round(celsius * 9 / 5 + 32)
const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN

export const weatherTool: PlannerTool = {
  name: 'weather',
  description: 'Weather for a place and dates: the forecast when the dates are within about two weeks, otherwise what it was like on those dates over the last few years (typical highs and lows, how many days had rain). Use it for packing, beach or ski plans and picking indoor days.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['place', 'start_date'], properties: {
    place: { type: 'string', description: 'Town or city, optionally with region or country: "Tulum, Mexico".' },
    start_date: { type: 'string', description: 'YYYY-MM-DD' }, end_date: { type: 'string', description: 'YYYY-MM-DD (up to 31 days after the start).' },
  } },
  async run(input, { signal }) {
    const start = isoDate(input.start_date), end = isoDate(input.end_date) ?? start
    if (!start || !end || end < start || Date.parse(end) - Date.parse(start) > 31 * 864e5) return fail('Give a start date (and an end date within 31 days), as YYYY-MM-DD.')
    const spot = await locate(text(input.place, 120), signal)
    if (!spot) return fail('Couldn’t find that place.')
    const daysAhead = (Date.parse(start) - Date.now()) / 864e5
    const base = `latitude=${spot.lat}&longitude=${spot.lng}&timezone=auto`
    if (daysAhead >= -1 && Date.parse(end) - Date.now() < 15 * 864e5) {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${base}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code`, { signal: signal ?? AbortSignal.timeout(8000) })
      if (!response.ok) return fail('The forecast isn’t available right now.')
      const daily = ((await response.json()) as { daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] } }).daily
      return ok({ place: `${spot.name}, ${spot.country ?? ''}`, kind: 'forecast', days: (daily?.time ?? []).map((day, i) => ({ date: day, high_c: Math.round(daily!.temperature_2m_max[i]), high_f: f(daily!.temperature_2m_max[i]), low_c: Math.round(daily!.temperature_2m_min[i]), low_f: f(daily!.temperature_2m_min[i]), chance_of_rain: daily!.precipitation_probability_max[i] })) })
    }
    // Further out: the same dates in each of the last three years.
    const years = await Promise.all([1, 2, 3].map(async back => {
      const from = shift(start, -back - Math.max(0, Math.ceil(-daysAhead / 365) - 1)), to = shift(end, Number(from.slice(0, 4)) - Number(start.slice(0, 4)))
      const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${from}&end_date=${to}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`, { signal: signal ?? AbortSignal.timeout(10_000) })
      if (!response.ok) return null
      return ((await response.json()) as { daily?: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] } }).daily ?? null
    }))
    const known = years.filter((year): year is NonNullable<typeof year> => !!year)
    if (!known.length) return fail('Past weather isn’t available right now.')
    const highs = known.flatMap(year => year.temperature_2m_max.filter(Number.isFinite)), lows = known.flatMap(year => year.temperature_2m_min.filter(Number.isFinite)), rain = known.flatMap(year => year.precipitation_sum.filter(Number.isFinite))
    return ok({ place: `${spot.name}, ${spot.country ?? ''}`, kind: 'typical (same dates, last 3 years)', avg_high_c: Math.round(avg(highs)), avg_high_f: f(avg(highs)), avg_low_c: Math.round(avg(lows)), avg_low_f: f(avg(lows)), rainy_days_share: rain.length ? `${Math.round(rain.filter(mm => mm >= 1).length / rain.length * 100)}%` : null })
  },
}

export const localEventsTool: PlannerTool = {
  name: 'local_events',
  description: 'Concerts, sports, theatre, festivals and other ticketed events near a place on given dates (from Ticketmaster). Use it to suggest something happening while they’re there, or to warn about big events that fill hotels.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['place', 'start_date', 'end_date'], properties: {
    place: { type: 'string' }, start_date: { type: 'string', description: 'YYYY-MM-DD' }, end_date: { type: 'string', description: 'YYYY-MM-DD' },
    keyword: { type: 'string', description: 'Optional: "jazz", "football", "food festival"…' },
  } },
  async run(input, { signal }) {
    const key = process.env.TICKETMASTER_API_KEY
    if (!key) return fail('Local events aren’t connected yet (no Ticketmaster key).')
    const start = isoDate(input.start_date), end = isoDate(input.end_date)
    if (!start || !end || end < start) return fail('Give start and end dates as YYYY-MM-DD.')
    const spot = await locate(text(input.place, 120), signal)
    if (!spot) return fail('Couldn’t find that place.')
    const params = new URLSearchParams({ apikey: key, latlong: `${spot.lat},${spot.lng}`, radius: '40', unit: 'km', startDateTime: `${start}T00:00:00Z`, endDateTime: `${end}T23:59:59Z`, size: '20', sort: 'date,asc', ...(text(input.keyword, 60) ? { keyword: text(input.keyword, 60) } : {}) })
    const response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, { signal: signal ?? AbortSignal.timeout(10_000) })
    if (!response.ok) return fail(`Events search failed (${response.status}).`)
    type Event = { name: string; url?: string; dates?: { start?: { localDate?: string; localTime?: string } }; classifications?: { segment?: { name?: string }; genre?: { name?: string } }[]; _embedded?: { venues?: { name?: string }[] } }
    const events = ((await response.json()) as { _embedded?: { events?: Event[] } })._embedded?.events ?? []
    return ok(events.length ? events.map(event => ({ name: event.name, date: event.dates?.start?.localDate, time: event.dates?.start?.localTime?.slice(0, 5), venue: event._embedded?.venues?.[0]?.name, kind: [event.classifications?.[0]?.segment?.name, event.classifications?.[0]?.genre?.name].filter(name => name && name !== 'Undefined').join(' · '), url: event.url })) : `No ticketed events found near ${spot.name} on those dates.`)
  },
}

export const toursTool: PlannerTool = {
  name: 'tours',
  description: 'Bookable tours, activities and attraction tickets (from Viator), e.g. "Sintra day trip from Lisbon" or "Grand Teton float trip": title, price from, rating, duration and a link.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 10 } } },
  async run(input, { signal }) {
    const key = process.env.VIATOR_API_KEY
    if (!key) return fail('Tours and tickets aren’t connected yet (no Viator key).')
    const query = text(input.query, 150)
    if (!query) return fail('Say what to look for.')
    const base = process.env.VIATOR_API_URL || 'https://api.viator.com/partner'
    const response = await fetch(`${base}/search/freetext`, { method: 'POST', signal: signal ?? AbortSignal.timeout(10_000),
      headers: { 'exp-api-key': key, 'Accept-Language': 'en-US', Accept: 'application/json;version=2.0', 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerm: query, currency: 'USD', searchTypes: [{ searchType: 'PRODUCTS', pagination: { start: 1, count: Math.min(10, Number(input.limit) || 6) } }] }) })
    if (!response.ok) return fail(`Tours search failed (${response.status}).`)
    type Product = { title?: string; productUrl?: string; pricing?: { summary?: { fromPrice?: number } }; reviews?: { combinedAverageRating?: number; totalReviews?: number }; duration?: { fixedDurationInMinutes?: number } }
    const products = ((await response.json()) as { products?: { results?: Product[] } }).products?.results ?? []
    return ok(products.map(product => ({ title: product.title, from_price_usd: product.pricing?.summary?.fromPrice, rating: product.reviews?.combinedAverageRating, reviews: product.reviews?.totalReviews, minutes: product.duration?.fixedDurationInMinutes, url: product.productUrl })))
  },
}

// The planner's existing live hotel prices, as one of the agent's tools.
export const hotelPrices: PlannerTool = {
  name: hotelPricesTool.name,
  description: hotelPricesTool.description ?? '',
  inputSchema: hotelPricesTool.input_schema as PlannerTool['inputSchema'],
  run: input => runHotelPrices(input),
}
