import OpenAI, { toFile } from 'openai'
import { pdfText } from '@/lib/pdfText'

// Turning travel notes and documents into an itinerary (places, days, dates). Used by the import (api/extract-pdf)
// and by the assistant connector's "import a trip" (api/mcp).
export const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export type ExtractedItem = { type: string; name: string; notes: string; mealType?: string; rating?: number; link?: string; dayIndex?: number; date?: string; time?: string; endDate?: string; endTime?: string }
export type ExtractedDest = { name: string; country: string; items: ExtractedItem[] }
export type ExtractedItinerary = {
  title: string
  description?: string
  durationDays?: number
  startDate?: string
  endDate?: string
  budget?: number
  currency?: string
  notes?: string
  destinations: ExtractedDest[]
}

export const EXTRACT_FUNCTION: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'extract_itinerary',
    description: 'Extract travel data into structured itinerary format.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        durationDays: { type: 'integer', minimum: 1, description: 'Explicit trip duration or last trip-wide scheduled day. Omit if neither is stated; never default to one.' },
        startDate: { type: 'string', description: 'YYYY-MM-DD' },
        endDate: { type: 'string', description: 'YYYY-MM-DD' },
        budget: { type: 'number' },
        currency: { type: 'string' },
        notes: { type: 'string' },
        destinations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              country: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['hotel', 'activity', 'food_drink', 'transport'] },
                    name: { type: 'string' },
                    notes: { type: 'string' },
                    booking: { type: 'string', description: 'Private booking details for the traveller only: confirmation or record numbers, booking references, seat and cabin, room type, who booked it. Never card or payment details. Omit if none.' },
                    mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] },
                    dayIndex: { type: 'integer', minimum: 1, description: 'Trip day number for dated restaurants or activities. Omit when no day is clear.' },
                    date: { type: 'string', description: 'Calendar date of the booking or visit, YYYY-MM-DD, exactly as the document gives it (a hotel: check-in date; a flight: departure date). Omit if the document gives no calendar date.' },
                    time: { type: 'string', description: 'Local start time, 24-hour HH:MM (a reservation time, tour start, hotel check-in time, flight departure). Omit if none is given.' },
                    endDate: { type: 'string', description: 'YYYY-MM-DD: a hotel\'s check-out date, a flight\'s arrival date, or the last day of a multi-day activity. Omit if none.' },
                    nights: { type: 'integer', minimum: 1, maximum: 60, description: 'Hotels only: nights stayed, from the document or from the days the itinerary spends there. Omit if unclear.' },
                    endTime: { type: 'string', description: 'Local end time, 24-hour HH:MM (check-out time, flight arrival, activity end). Omit if none.' },
                    rating: { type: 'integer', minimum: 1, maximum: 5, description: 'Always omit: only the traveller rates places.' },
                  },
                  required: ['type', 'name', 'notes'],
                },
              },
            },
            required: ['name', 'country', 'items'],
          },
        },
      },
      required: ['title', 'destinations'],
    },
  },
}

const EXTRACT_PROMPT = `Extract only confirmed or scheduled items from this travel document. It may be a professionally compiled itinerary, booking confirmation, reservation email, hotel folio, or trip notes.

- Include a place only when it is actually booked, scheduled, attended, stayed at, or explicitly placed on the itinerary. For a professional itinerary, entries in its day-by-day schedule count as confirmed.
- Exclude suggestions, recommendations, options, alternatives, "consider" lists, nearby places, and unselected restaurants or activities — even if they sound appealing.
- Before extracting individual reservations, inspect the whole document for the property that issued it. Include accommodation when the overall context makes it clear with high confidence that this is where the traveller is staying, even if the booking details are absent. A prominent hotel or resort name/logo in the header, cover, letterhead, or recurring page header is strong evidence — especially when the document contains the traveller's confirmed on-property dining, spa, or other services. In that case, you MUST add that named property once as a "hotel" item, even if there is no separate room confirmation. A named property paired with the itinerary or repeated references establishing it as the trip base are also strong evidence. Do not treat a generic supplier logo, a meeting point, or a passing hotel mention as accommodation, and never invent a hotel from the destination alone.
- Classify each remaining item as "food_drink" (a confirmed restaurant, bar, cafe, or dining reservation) or "activity" (a confirmed tour, sight, spa, or experience).
- Do not extract guide names, tour-leader names, meeting points, guide meeting instructions, or guide contact details as itinerary items. If a named guide company is the booked tour provider, you may include the company as the activity; do not include an individual guide's name.
- For food_drink, infer mealType from the time if given: before 11am = breakfast, 11am–3pm = lunch, 3pm–6pm = drinks or coffee, after 6pm = dinner. Otherwise pick the best fit.
- For restaurants and activities with a clear date or day in the document, include dayIndex counting from Day 1 of the entire trip — not Day 1 of that destination. For example, if Rome is Days 1–2 and Puglia is Days 3–5, a Puglia dinner on Day 3 gets dayIndex 3, not dayIndex 1. Do not guess a day when the document does not establish one. Hotels are location-level stays: omit dayIndex for them.
- DATES AND TIMES: For every item, copy the real calendar date (date, YYYY-MM-DD) and local time (time, 24-hour HH:MM) exactly as the document states them: a dinner reservation's date and time, a tour's date and start time, a hotel's check-in date (date) and check-out date (endDate) with their times if given, a flight's departure (date, time) and arrival (endDate, endTime). Work out the year from the document when it is only implied. Never invent or estimate a date or time; omit them when the document doesn't give them.
- RATINGS: never include a rating. Only the traveller rates places, in the app. Guide or press awards (Michelin stars or keys, Forbes stars, "best of" lists) and general praise are not ratings; mention a notable award in notes instead.
- HOTELS ON DAYS: for each place to stay in a day-by-day itinerary, set dayIndex to the trip day of check-in (counting from Day 1 of the whole trip) and nights to how many nights are spent there (from the document, or from which days the itinerary spends at that stop).
- Write notes for someone deciding whether they would want to stay there, do the activity, or visit the restaurant. Keep only concise, generally useful context such as what the experience includes, a notable feature, atmosphere, location context, or a broadly relevant dress code. If there is nothing genuinely useful to say about the place itself, leave notes as an empty string — do not fill it with booking status, confirmation phrases ("confirmed dinner", "reserved", "booked"), or any logistics. Omit: confirmation numbers and dates, cancellation or payment terms, rates, contact details, check-in instructions, transport coordination, seating or dietary requests, and similar personal logistics.
- Populate startDate/endDate only from actual trip dates in the document (YYYY-MM-DD). Do not use document creation dates or invent dates. Set durationDays from an explicit duration or the final day of a day-by-day itinerary even when calendar dates are absent. If neither is provided, omit durationDays and dates; this is an undated guide, not a one-day trip.
- Include transportation as "transport": flights, ferries, trains, buses, transfers, car rentals, taxis and rideshare. Never skip a flight: the outbound flight counts even when it departs the evening before the dates in the document's title (an overnight flight leaving Aug 12 for a trip "August 13 to 21" is still an item, dated Aug 12), and so does the flight home. Also preserve explicitly supplied advice about getting around, such as Uber availability, as transport entries. Put each transport item under the destination it serves, never a destination of its own for the city it leaves from: the flight out goes under the first stop of the trip (flying JFK to Lisbon is a Lisbon item, not a New York destination), the flight home under the last stop, and a transfer between stops under the stop it arrives at. For transport, retain useful routes, departure times, flight numbers, and booking advice in notes; put confirmation numbers, booking references, seats and room types in "booking" (kept private to the traveller), never in notes, and never include card or payment details anywhere.`

export const PDF_JSON_INSTRUCTION = `Return only valid JSON in exactly this shape:
{"title":"","description":"","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","notes":"","destinations":[{"name":"","country":"","items":[{"type":"hotel|activity|food_drink|transport","name":"","notes":"","booking":"","dayIndex":1,"date":"YYYY-MM-DD","time":"HH:MM","endDate":"YYYY-MM-DD","endTime":"HH:MM","mealType":"breakfast|lunch|dinner|drinks|coffee|dessert|bakery","nights":2}]}]}.
Use an empty array for destinations only when the document contains no travel places.`

// Every place needs a location. Imports into a planned trip also say where the trip is going, so places listed
// without a city land under the right destination, and planning notes keep ideas, not just bookings.
export function extractPrompt(planning: boolean, tripDestinations: string[]) {
  const notes = planning ? `
These are planning notes for a trip: include every place listed (ideas and recommendations too), not only confirmed bookings.` : ''
  // The planner files every place under the trip's destination itself; it asks for each place's own town so
  // the place can be found on Google.
  const trip = tripDestinations.length ? `
The trip is planned to: ${tripDestinations.join('; ')}. When the document divides the trip into named stops, regions or legs (for example "Loire Valley", "Bordeaux", "Paris"), use those names as the destinations, each place under the stop it is listed in, in the order of the trip. Otherwise give each place the real town or city it is in as its destination (with its country), even when that is a nearby town rather than the trip destination. Use the trip destination itself only for places you can't place more precisely.` : ''
  return `${EXTRACT_PROMPT}

LOCATIONS: Every destination needs a name and country; never leave them empty. If the document is organised into named stops or regions, those are the destinations (not the country or the trip's overall title). When the document doesn't say where a place is, use what you know about the place (or the rest of the document) to give its real city or area and country.${notes}${trip}`
}

export function parseResult(completion: OpenAI.Chat.ChatCompletion): ExtractedItinerary {
  const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.type !== 'function') throw new Error('Could not extract itinerary.')
  return JSON.parse(toolCall.function.arguments) as ExtractedItinerary
}

export async function fetchBlob(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2 * 60 * 1000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Failed to download uploaded file: ${response.status}`)
    return response
  } catch (err) {
    if (controller.signal.aborted) throw new Error('Downloading the uploaded file timed out.')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function extractFromText(text: string, prompt: string): Promise<ExtractedItinerary> {
  const completion = await client.chat.completions.create({
    model: 'gpt-5.6-terra',
    reasoning_effort: 'none',
    tools: [EXTRACT_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
    messages: [{ role: 'user', content: `${prompt}\n\nDOCUMENT:\n${text}` }],
  })
  return parseResult(completion)
}

// A PDF's itinerary: the file itself goes to the AI (up to 50 MB); bigger ones (usually full of photos) send their text.
export async function extractFromPdfBuffer(buffer: Buffer, filename: string, prompt: string): Promise<ExtractedItinerary> {
  // The AI takes PDFs up to 50 MB. Bigger ones (usually full of photos) send just their text.
  if (buffer.length > 45 * 1024 * 1024) {
    const text = await pdfText(new Uint8Array(buffer))
    if (text.replace(/Page \d+:|\s/g, '').length < 200) throw new Error('This PDF is too big to read and has no text in it (it may be scanned pages). Try a smaller copy, or paste the itinerary as notes.')
    return extractFromText(text, prompt)
  }
  const file = await client.files.create({
    file: await toFile(buffer, filename, { type: 'application/pdf' }),
    purpose: 'user_data',
  })
  try {
    const response = await client.responses.create({
      model: 'gpt-5.6-terra',
      input: [{
        role: 'user',
        content: [
          { type: 'input_file', file_id: file.id },
          { type: 'input_text', text: `${prompt}\n\n${PDF_JSON_INSTRUCTION}` },
        ],
      }],
      text: {
        format: { type: 'json_object' },
      },
    })
    return JSON.parse(response.output_text) as ExtractedItinerary
  } finally {
    await client.files.delete(file.id).catch(() => undefined)
  }
}

export async function extractFromImageBase64(base64: string, contentType: string, prompt: string): Promise<ExtractedItinerary> {
  const completion = await client.chat.completions.create({
    model: 'gpt-5.6-terra',
    reasoning_effort: 'none',
    tools: [EXTRACT_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } },
        { type: 'text', text: prompt },
      ],
    }],
  })
  return parseResult(completion)
}
