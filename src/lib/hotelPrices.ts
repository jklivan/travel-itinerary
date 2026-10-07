import type Anthropic from '@anthropic-ai/sdk'

// Live hotel prices from LiteAPI (https://docs.liteapi.travel), for the trip planner's hotel_prices tool.
// The key stays on the server; the planner only sees the trimmed results below.
const LITEAPI = 'https://api.liteapi.travel/v3.0'

export const hotelPricesTool: Anthropic.Tool = {
  name: 'hotel_prices',
  description: 'Look up live hotel prices for specific dates. Use it whenever the traveler asks what hotels cost, about their budget, or for cheaper or better-value places to stay. Search a city for the best-priced options, or pass hotel_name to price one hotel. Pass one entry in rooms per hotel room needed. Returns each hotel\'s cheapest offer for all the rooms together: total price, price per night (all rooms), each room\'s type, and whether it\'s refundable.',
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['city', 'country_code', 'checkin', 'checkout', 'rooms'],
    properties: {
      city: { type: 'string', description: 'City or town, e.g. "Positano".' },
      country_code: { type: 'string', description: 'ISO 3166-1 alpha-2 country code, e.g. "IT".' },
      hotel_name: { type: 'string', description: 'Price one hotel by name (e.g. "Le Sirenuse"). Omit to search the whole city.' },
      checkin: { type: 'string', description: 'Check-in date, YYYY-MM-DD.' },
      checkout: { type: 'string', description: 'Check-out date, YYYY-MM-DD.' },
      rooms: {
        type: 'array', description: 'One entry per room (1-4 rooms), e.g. 5 people as [{adults: 3}, {adults: 2}] or as one family room [{adults: 2, children_ages: [8, 10, 13]}].',
        items: { type: 'object', additionalProperties: false, required: ['adults'], properties: {
          adults: { type: 'integer', description: 'Adults in this room.' },
          children_ages: { type: 'array', items: { type: 'integer' }, description: 'Ages of children in this room, if any.' },
        } },
      },
      max_price_per_night: { type: 'number', description: 'Only hotels at or under this nightly price, in USD.' },
    },
  },
}

type Room = { adults: number; children_ages?: number[] }
type Input = { city: string; country_code: string; hotel_name?: string; checkin: string; checkout: string; rooms: Room[]; max_price_per_night?: number }

// The tool's input streams in as it's written, so check it before using it.
function parseInput(raw: unknown): Input | string {
  const value = raw as Partial<Input> | null
  const date = /^\d{4}-\d{2}-\d{2}$/
  if (!value || typeof value !== 'object') return 'Input must be an object.'
  if (typeof value.city !== 'string' || !value.city.trim()) return 'city is required.'
  if (typeof value.country_code !== 'string' || !/^[A-Za-z]{2}$/.test(value.country_code)) return 'country_code must be a 2-letter code.'
  if (typeof value.checkin !== 'string' || !date.test(value.checkin) || typeof value.checkout !== 'string' || !date.test(value.checkout)) return 'checkin and checkout must be YYYY-MM-DD.'
  if (value.checkout <= value.checkin) return 'checkout must be after checkin.'
  // Past dates have no rooms, which would read as "sold out".
  const today = new Date().toISOString().slice(0, 10)
  if (value.checkin < today) return `checkin ${value.checkin} is in the past (today is ${today}). Search upcoming dates: a month with no year means its next one.`
  if (!Array.isArray(value.rooms) || value.rooms.length < 1 || value.rooms.length > 4) return 'rooms must list 1-4 rooms.'
  for (const room of value.rooms as Room[]) {
    if (!room || !Number.isInteger(room.adults) || room.adults < 1 || room.adults > 6) return 'Each room needs 1-6 adults.'
    if (room.children_ages !== undefined && (!Array.isArray(room.children_ages) || room.children_ages.length > 4 || room.children_ages.some(age => !Number.isInteger(age) || age < 0 || age > 17))) return 'children_ages must be up to 4 ages, 0-17.'
  }
  if (value.hotel_name !== undefined && typeof value.hotel_name !== 'string') return 'hotel_name must be text.'
  if (value.max_price_per_night !== undefined && (typeof value.max_price_per_night !== 'number' || value.max_price_per_night <= 0)) return 'max_price_per_night must be a positive number.'
  return value as Input
}

type Rate = { name?: string; occupancyNumber?: number; boardType?: string; boardName?: string; cancellationPolicies?: { refundableTag?: string } }
type RatesResponse = {
  data?: { hotelId: string; roomTypes?: { offerRetailRate?: { amount: number; currency: string }; rates?: Rate[] }[] }[]
  hotels?: { id: string; name?: string; stars?: number; rating?: number; review_count?: number; address?: string; city_name?: string }[]
  error?: { message?: string }
}

const words = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(word => word.length > 2 && !['hotel', 'resort', 'the', 'and', 'spa'].includes(word))
// A nearby hotel is the one asked for when they share a distinctive word ("Bürgenstock Resort" / "Bürgenstock Hotel").
const sameHotel = (asked: string, found: string) => { const wanted = words(asked); return wanted.length > 0 && words(found).some(word => wanted.includes(word)) }

async function liteapi<T>(key: string, path: string, init?: RequestInit): Promise<{ ok: boolean; data: T }> {
  const response = await fetch(`${LITEAPI}${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'X-API-Key': key }, signal: AbortSignal.timeout(15_000) })
  return { ok: response.ok, data: await response.json().catch(() => ({})) as T }
}

// Where a named hotel is, from Google Places (the hotel's own city in LiteAPI can differ from the one the traveler says,
// e.g. Bürgenstock Resort is filed under Obbürgen, not Lucerne).
async function locateHotel(name: string, city: string, country: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API
  if (!key) return null
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.location' },
    body: JSON.stringify({ textQuery: `${name}, ${city}, ${country}`, pageSize: 1 }),
  }).catch(() => null)
  const location = response?.ok ? ((await response.json()) as { places?: { location?: { latitude: number; longitude: number } }[] }).places?.[0]?.location : undefined
  return location ? { latitude: location.latitude, longitude: location.longitude } : null
}

type Priced = { hotel: string; stars: number | null; guestRating: number | null; reviews: number | null; address: string | null; totalPrice: number; pricePerNight: number; currency: string; rooms: string[]; board: string | null; refundable: boolean }
function pricedHotels(data: RatesResponse, nights: number, extraHotels: RatesResponse['hotels'] = []): Priced[] {
  const hotels = new Map([...(data.hotels ?? []), ...(extraHotels ?? [])].map(hotel => [hotel.id, hotel]))
  return (data.data ?? []).flatMap(entry => {
    // Each hotel's cheapest offer for the dates; an offer covers all the rooms asked for, with one rate per room.
    const cheapest = (entry.roomTypes ?? []).filter(room => room.offerRetailRate?.amount).sort((a, b) => a.offerRetailRate!.amount - b.offerRetailRate!.amount)[0]
    if (!cheapest?.offerRetailRate) return []
    const hotel = hotels.get(entry.hotelId)
    const rates = cheapest.rates ?? []
    const rate = rates[0]
    return [{
      hotel: hotel?.name ?? entry.hotelId, stars: hotel?.stars ?? null, guestRating: hotel?.rating ?? null, reviews: hotel?.review_count ?? null,
      address: hotel?.address ?? null, totalPrice: Math.round(cheapest.offerRetailRate.amount), pricePerNight: Math.round(cheapest.offerRetailRate.amount / nights), currency: cheapest.offerRetailRate.currency,
      rooms: rates.map(r => r.name ?? 'Room'), board: rate?.boardName ?? rate?.boardType ?? null, refundable: rates.length > 0 && rates.every(r => r.cancellationPolicies?.refundableTag === 'RFN'),
    }]
  })
}

type GoogleProperty = { name?: string; hotel_class?: string; extracted_hotel_class?: number; overall_rating?: number; reviews?: number; rate_per_night?: { extracted_lowest?: number }; total_rate?: { extracted_lowest?: number }; prices?: { source?: string; rate_per_night?: { extracted_lowest?: number } }[] }
// Backup when LiteAPI has no price: Google Hotels' prices (from Booking.com, Expedia, the hotel's site…) via SerpApi.
// Only with SERPAPI_KEY set. These can't be booked through Postcard.
async function googleHotelPrices(input: Input, nights: number) {
  const key = process.env.SERPAPI_KEY
  if (!key) return null
  const children = input.rooms.flatMap(room => room.children_ages ?? [])
  const params = new URLSearchParams({
    engine: 'google_hotels', api_key: key, q: input.hotel_name?.trim() ? `${input.hotel_name.trim()} ${input.city}` : `hotels in ${input.city}`,
    check_in_date: input.checkin, check_out_date: input.checkout, adults: String(input.rooms.reduce((sum, room) => sum + room.adults, 0)),
    currency: 'USD', gl: 'us', hl: 'en', ...(children.length ? { children: String(children.length), children_ages: children.join(',') } : {}),
  })
  const response = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null)
  if (!response?.ok) return null
  const data = await response.json() as GoogleProperty & { properties?: GoogleProperty[] }
  // A query naming one hotel can come back as that hotel's own page rather than a list.
  const properties = data.properties ?? (data.name ? [data] : [])
  return properties.flatMap(property => {
    const perNight = property.rate_per_night?.extracted_lowest
    if (!property.name || !perNight || (input.hotel_name?.trim() && !sameHotel(input.hotel_name, property.name))) return []
    return [{
      hotel: property.name, stars: property.extracted_hotel_class ?? null, guestRating: property.overall_rating ?? null, reviews: property.reviews ?? null,
      pricePerNight: Math.round(perNight), totalPrice: Math.round(property.total_rate?.extracted_lowest ?? perNight * nights), currency: 'USD',
      sources: (property.prices ?? []).flatMap(price => price.source && price.rate_per_night?.extracted_lowest ? [`${price.source} $${Math.round(price.rate_per_night.extracted_lowest)}`] : []).slice(0, 4),
    }]
  }).filter(hotel => !input.max_price_per_night || hotel.pricePerNight <= input.max_price_per_night)
    .sort((a, b) => a.pricePerNight - b.pricePerNight).slice(0, 8)
}

// Returns the text the planner reads as the tool result (JSON), or an error message. LiteAPI first (bookable, earns
// commission); a named hotel it can't find by city is looked up by its location; Google Hotels is the backup.
export async function runHotelPrices(raw: unknown): Promise<{ content: string; isError?: boolean }> {
  const key = process.env.LITEAPI_KEY
  if (!key) return { content: 'Live hotel prices are not set up yet.', isError: true }
  const input = parseInput(raw)
  if (typeof input === 'string') return { content: input, isError: true }
  const nights = Math.round((Date.parse(input.checkout) - Date.parse(input.checkin)) / 86_400_000)
  const name = input.hotel_name?.trim()
  const stay = {
    checkin: input.checkin, checkout: input.checkout, currency: 'USD', guestNationality: 'US',
    occupancies: input.rooms.map(room => ({ adults: room.adults, ...(room.children_ages?.length ? { children: room.children_ages } : {}) })),
    maxRatesPerHotel: 1, timeout: 8, includeHotelData: true,
  }
  const result = (provider: string, status: string, note: string, hotels: unknown[]) => ({ content: JSON.stringify({
    provider, status, checkin: input.checkin, checkout: input.checkout, nights,
    rooms: input.rooms.map(room => ({ adults: room.adults, children: room.children_ages?.length ?? 0 })), note, hotels,
  }) })
  try {
    const first = await liteapi<RatesResponse>(key, '/hotels/rates', { method: 'POST', body: JSON.stringify({
      ...stay, cityName: input.city.trim(), countryCode: input.country_code.toUpperCase(), ...(name ? { hotelName: name } : {}), limit: name ? 10 : 60,
    }) })
    if (!first.ok) return { content: `Price lookup failed: ${first.data.error?.message ?? 'LiteAPI error'}`, isError: true }
    let priced = pricedHotels(first.data, nights)
    // Whether LiteAPI has the named hotel at all, so "no rooms" (sold out) and "not on this feed" can be told apart.
    let listed = !!name && (first.data.hotels ?? []).some(hotel => hotel.name && sameHotel(name, hotel.name))
    if (name && !priced.length && !listed) {
      const spot = await locateHotel(name, input.city, input.country_code)
      if (spot) {
        const nearby = await liteapi<{ data?: NonNullable<RatesResponse['hotels']> & { name?: string }[] }>(key, `/data/hotels?${new URLSearchParams({ countryCode: input.country_code.toUpperCase(), latitude: String(spot.latitude), longitude: String(spot.longitude), radius: '2000', limit: '50' })}`)
        const matches = (nearby.data.data ?? []).filter(hotel => hotel.name && sameHotel(name, hotel.name))
        listed = matches.length > 0
        if (listed) {
          const second = await liteapi<RatesResponse>(key, '/hotels/rates', { method: 'POST', body: JSON.stringify({ ...stay, hotelIds: matches.slice(0, 5).map(hotel => hotel.id) }) })
          if (second.ok) priced = pricedHotels(second.data, nights, matches)
        }
      }
    }
    priced = priced.filter(hotel => !input.max_price_per_night || hotel.pricePerNight <= input.max_price_per_night)
      .sort((a, b) => a.pricePerNight - b.pricePerNight).slice(0, 8)
    if (priced.length) return result('liteapi', 'priced', 'Live rates for these dates from LiteAPI, cheapest first; prices cover all the rooms together, can be booked, and can change.', priced)

    const why = name ? (listed ? 'LiteAPI has this hotel but no rooms for these dates and guests (often sold out, or not released yet).' : 'This hotel is not on LiteAPI\'s feed.') : 'LiteAPI had no rooms in this city for these dates and guests.'
    const google = await googleHotelPrices(input, nights)
    if (google?.length) return result('google_hotels', 'priced_elsewhere', `${why} Prices shown are Google Hotels' (from booking sites), for reference only: they can't be booked through Postcard. Each is per night for the whole group together; Google Hotels doesn't say how many rooms that covers, so say it's for all the guests and don't compare it with a price for a set number of rooms.`, google)
    return result('liteapi', name && listed ? 'no_availability' : name ? 'not_listed' : 'no_availability', `${why}${process.env.SERPAPI_KEY ? ' Google Hotels had no prices either.' : ''}`, [])
  } catch {
    return { content: 'The price lookup timed out. Try again or suggest checking the hotel directly.', isError: true }
  }
}
