import type Anthropic from '@anthropic-ai/sdk'

// Live hotel prices from LiteAPI (https://docs.liteapi.travel), for the trip planner's hotel_prices tool.
// The key stays on the server; the planner only sees the trimmed results below.
const LITEAPI = 'https://api.liteapi.travel/v3.0'

export const hotelPricesTool: Anthropic.Tool = {
  name: 'hotel_prices',
  description: 'Look up live hotel prices for specific dates. Use it whenever the traveler asks what hotels cost, about their budget, or for cheaper or better-value places to stay. Search a city for the best-priced options, or pass hotel_name to price one hotel. Returns each hotel\'s cheapest available room for the dates: total price, price per night, room, and whether it\'s refundable.',
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['city', 'country_code', 'checkin', 'checkout', 'adults'],
    properties: {
      city: { type: 'string', description: 'City or town, e.g. "Positano".' },
      country_code: { type: 'string', description: 'ISO 3166-1 alpha-2 country code, e.g. "IT".' },
      hotel_name: { type: 'string', description: 'Price one hotel by name (e.g. "Le Sirenuse"). Omit to search the whole city.' },
      checkin: { type: 'string', description: 'Check-in date, YYYY-MM-DD.' },
      checkout: { type: 'string', description: 'Check-out date, YYYY-MM-DD.' },
      adults: { type: 'integer', description: 'Adults sharing one room.' },
      children_ages: { type: 'array', items: { type: 'integer' }, description: 'Ages of children in the room, if any.' },
      max_price_per_night: { type: 'number', description: 'Only hotels at or under this nightly price, in USD.' },
    },
  },
}

type Input = { city: string; country_code: string; hotel_name?: string; checkin: string; checkout: string; adults: number; children_ages?: number[]; max_price_per_night?: number }

// The tool's input streams in as it's written, so check it before using it.
function parseInput(raw: unknown): Input | string {
  const value = raw as Partial<Input> | null
  const date = /^\d{4}-\d{2}-\d{2}$/
  if (!value || typeof value !== 'object') return 'Input must be an object.'
  if (typeof value.city !== 'string' || !value.city.trim()) return 'city is required.'
  if (typeof value.country_code !== 'string' || !/^[A-Za-z]{2}$/.test(value.country_code)) return 'country_code must be a 2-letter code.'
  if (typeof value.checkin !== 'string' || !date.test(value.checkin) || typeof value.checkout !== 'string' || !date.test(value.checkout)) return 'checkin and checkout must be YYYY-MM-DD.'
  if (value.checkout <= value.checkin) return 'checkout must be after checkin.'
  if (!Number.isInteger(value.adults) || value.adults! < 1 || value.adults! > 8) return 'adults must be 1-8.'
  if (value.children_ages !== undefined && (!Array.isArray(value.children_ages) || value.children_ages.some(age => !Number.isInteger(age) || age < 0 || age > 17))) return 'children_ages must be ages 0-17.'
  if (value.hotel_name !== undefined && typeof value.hotel_name !== 'string') return 'hotel_name must be text.'
  if (value.max_price_per_night !== undefined && (typeof value.max_price_per_night !== 'number' || value.max_price_per_night <= 0)) return 'max_price_per_night must be a positive number.'
  return value as Input
}

type Rate = { name?: string; boardType?: string; boardName?: string; cancellationPolicies?: { refundableTag?: string } }
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
        occupancies: [{ adults: input.adults, ...(input.children_ages?.length ? { children: input.children_ages } : {}) }],
        limit: input.hotel_name?.trim() ? 10 : 60, maxRatesPerHotel: 1, timeout: 8, includeHotelData: true,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await response.json().catch(() => ({})) as RatesResponse
    if (!response.ok) return { content: `Price lookup failed: ${data.error?.message ?? response.status}`, isError: true }
    const hotels = new Map((data.hotels ?? []).map(hotel => [hotel.id, hotel]))
    const priced = (data.data ?? []).flatMap(entry => {
      // Each hotel's cheapest room for the dates.
      const cheapest = (entry.roomTypes ?? []).filter(room => room.offerRetailRate?.amount).sort((a, b) => a.offerRetailRate!.amount - b.offerRetailRate!.amount)[0]
      if (!cheapest?.offerRetailRate) return []
      const hotel = hotels.get(entry.hotelId)
      const rate = cheapest.rates?.[0]
      const perNight = Math.round(cheapest.offerRetailRate.amount / nights)
      return [{
        hotel: hotel?.name ?? entry.hotelId, stars: hotel?.stars ?? null, guestRating: hotel?.rating ?? null, reviews: hotel?.review_count ?? null,
        address: hotel?.address ?? null, totalPrice: Math.round(cheapest.offerRetailRate.amount), pricePerNight: perNight, currency: cheapest.offerRetailRate.currency,
        room: rate?.name ?? null, board: rate?.boardName ?? rate?.boardType ?? null, refundable: rate?.cancellationPolicies?.refundableTag === 'RFN',
      }]
    }).filter(hotel => !input.max_price_per_night || hotel.pricePerNight <= input.max_price_per_night)
      .sort((a, b) => a.pricePerNight - b.pricePerNight).slice(0, 8)
    return { content: JSON.stringify({
      checkin: input.checkin, checkout: input.checkout, nights, guests: { adults: input.adults, children: input.children_ages?.length ?? 0 },
      note: 'Live rates for these dates from LiteAPI, cheapest first; they can change.',
      hotels: priced,
    }) }
  } catch {
    return { content: 'The price lookup timed out. Try again or suggest checking the hotel directly.', isError: true }
  }
}
