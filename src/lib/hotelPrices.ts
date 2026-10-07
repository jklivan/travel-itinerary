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

// Returns the text the planner reads as the tool result (JSON), or an error message.
export async function runHotelPrices(raw: unknown): Promise<{ content: string; isError?: boolean }> {
  const key = process.env.LITEAPI_KEY
  if (!key) return { content: 'Live hotel prices are not set up yet.', isError: true }
  const input = parseInput(raw)
  if (typeof input === 'string') return { content: input, isError: true }
  const nights = Math.round((Date.parse(input.checkout) - Date.parse(input.checkin)) / 86_400_000)
  try {
    const response = await fetch(`${LITEAPI}/hotels/rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        cityName: input.city.trim(), countryCode: input.country_code.toUpperCase(),
        ...(input.hotel_name?.trim() ? { hotelName: input.hotel_name.trim() } : {}),
        checkin: input.checkin, checkout: input.checkout, currency: 'USD', guestNationality: 'US',
        occupancies: input.rooms.map(room => ({ adults: room.adults, ...(room.children_ages?.length ? { children: room.children_ages } : {}) })),
        limit: input.hotel_name?.trim() ? 10 : 60, maxRatesPerHotel: 1, timeout: 8, includeHotelData: true,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await response.json().catch(() => ({})) as RatesResponse
    if (!response.ok) return { content: `Price lookup failed: ${data.error?.message ?? response.status}`, isError: true }
    const hotels = new Map((data.hotels ?? []).map(hotel => [hotel.id, hotel]))
    const priced = (data.data ?? []).flatMap(entry => {
      // Each hotel's cheapest offer for the dates; an offer covers all the rooms asked for, with one rate per room.
      const cheapest = (entry.roomTypes ?? []).filter(room => room.offerRetailRate?.amount).sort((a, b) => a.offerRetailRate!.amount - b.offerRetailRate!.amount)[0]
      if (!cheapest?.offerRetailRate) return []
      const hotel = hotels.get(entry.hotelId)
      const rates = cheapest.rates ?? []
      const rate = rates[0]
      const perNight = Math.round(cheapest.offerRetailRate.amount / nights)
      return [{
        hotel: hotel?.name ?? entry.hotelId, stars: hotel?.stars ?? null, guestRating: hotel?.rating ?? null, reviews: hotel?.review_count ?? null,
        address: hotel?.address ?? null, totalPrice: Math.round(cheapest.offerRetailRate.amount), pricePerNight: perNight, currency: cheapest.offerRetailRate.currency,
        rooms: rates.map(r => r.name ?? 'Room'), board: rate?.boardName ?? rate?.boardType ?? null, refundable: rates.length > 0 && rates.every(r => r.cancellationPolicies?.refundableTag === 'RFN'),
      }]
    }).filter(hotel => !input.max_price_per_night || hotel.pricePerNight <= input.max_price_per_night)
      .sort((a, b) => a.pricePerNight - b.pricePerNight).slice(0, 8)
    return { content: JSON.stringify({
      checkin: input.checkin, checkout: input.checkout, nights, rooms: input.rooms.map(room => ({ adults: room.adults, children: room.children_ages?.length ?? 0 })),
      note: 'Live rates for these dates from LiteAPI, cheapest first; prices cover all the rooms together and can change.',
      hotels: priced,
    }) }
  } catch {
    return { content: 'The price lookup timed out. Try again or suggest checking the hotel directly.', isError: true }
  }
}
