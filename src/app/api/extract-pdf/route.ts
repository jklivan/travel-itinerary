import OpenAI, { toFile } from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { get } from '@vercel/blob'

export const maxDuration = 300

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

type ExtractedItem = { type: string; name: string; notes: string; mealType?: string; rating?: number; link?: string; dayIndex?: number; date?: string; time?: string; endDate?: string; endTime?: string }
type ExtractedDest = { name: string; country: string; items: ExtractedItem[] }
type ExtractedItinerary = {
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

const EXTRACT_FUNCTION: OpenAI.Chat.ChatCompletionTool = {
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
                    mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] },
                    dayIndex: { type: 'integer', minimum: 1, description: 'Trip day number for dated restaurants or activities. Omit when no day is clear.' },
                    date: { type: 'string', description: 'Calendar date of the booking or visit, YYYY-MM-DD, exactly as the document gives it (a hotel: check-in date; a flight: departure date). Omit if the document gives no calendar date.' },
                    time: { type: 'string', description: 'Local start time, 24-hour HH:MM (a reservation time, tour start, hotel check-in time, flight departure). Omit if none is given.' },
                    endDate: { type: 'string', description: 'YYYY-MM-DD: a hotel\'s check-out date, a flight\'s arrival date, or the last day of a multi-day activity. Omit if none.' },
                    endTime: { type: 'string', description: 'Local end time, 24-hour HH:MM (check-out time, flight arrival, activity end). Omit if none.' },
                    rating: { type: 'integer', minimum: 1, maximum: 5, description: 'Scale any expressed sentiment to 1-5. Omit if none.' },
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
- Rate 1–5 stars if any sentiment is expressed. Omit rating if none.
- Write notes for someone deciding whether they would want to stay there, do the activity, or visit the restaurant. Keep only concise, generally useful context such as what the experience includes, a notable feature, atmosphere, location context, or a broadly relevant dress code. If there is nothing genuinely useful to say about the place itself, leave notes as an empty string — do not fill it with booking status, confirmation phrases ("confirmed dinner", "reserved", "booked"), or any logistics. Omit: confirmation numbers and dates, cancellation or payment terms, rates, contact details, check-in instructions, transport coordination, seating or dietary requests, and similar personal logistics.
- Populate startDate/endDate only from actual trip dates in the document (YYYY-MM-DD). Do not use document creation dates or invent dates. Set durationDays from an explicit duration or the final day of a day-by-day itinerary even when calendar dates are absent. If neither is provided, omit durationDays and dates; this is an undated guide, not a one-day trip.
- Include transportation as "transport": flights, ferries, trains, buses, transfers, car rentals, taxis and rideshare. Also preserve explicitly supplied advice about getting around, such as Uber availability, as transport entries. For transport, retain useful routes, departure times, flight numbers, and booking advice in notes; omit personal confirmation codes and payment details.`

const PDF_JSON_INSTRUCTION = `Return only valid JSON in exactly this shape:
{"title":"","description":"","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","notes":"","destinations":[{"name":"","country":"","items":[{"type":"hotel|activity|food_drink|transport","name":"","notes":"","dayIndex":1,"date":"YYYY-MM-DD","time":"HH:MM","endDate":"YYYY-MM-DD","endTime":"HH:MM","mealType":"breakfast|lunch|dinner|drinks|coffee|dessert|bakery","rating":1}]}]}.
Use an empty array for destinations only when the document contains no travel places.`

// Every place needs a location. Imports into a planned trip also say where the trip is going, so places listed
// without a city land under the right destination, and planning notes keep ideas, not just bookings.
function extractPrompt(planning: boolean, tripDestinations: string[]) {
  const notes = planning ? `
These are planning notes for a trip: include every place listed (ideas and recommendations too), not only confirmed bookings.` : ''
  // The planner files every place under the trip's destination itself; it asks for each place's own town so
  // the place can be found on Google.
  const trip = tripDestinations.length ? `
The trip is planned to: ${tripDestinations.join('; ')}. For each place, give the real town or city it is in as its destination (with its country), even when that is a nearby town rather than the trip destination. Use the trip destination only for places that are in it or that you can't place.` : ''
  return `${EXTRACT_PROMPT}

LOCATIONS: Every destination needs a name and country; never leave them empty. When the document doesn't say where a place is, use what you know about the place (or the rest of the document) to give its real city or area and country.${notes}${trip}`
}

function parseResult(completion: OpenAI.Chat.ChatCompletion): ExtractedItinerary {
  const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.type !== 'function') throw new Error('Could not extract itinerary.')
  return JSON.parse(toolCall.function.arguments) as ExtractedItinerary
}

async function fetchBlob(url: string): Promise<Response> {
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

async function extractFromText(text: string, prompt: string): Promise<ExtractedItinerary> {
  const completion = await client.chat.completions.create({
    model: 'gpt-5.6-terra',
    reasoning_effort: 'none',
    tools: [EXTRACT_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
    messages: [{ role: 'user', content: `${prompt}\n\nDOCUMENT:\n${text}` }],
  })
  return parseResult(completion)
}

async function extractFromPrivatePdf(url: string, filename: string, prompt: string): Promise<ExtractedItinerary> {
  // Private Blob uploads use the same proven route as trip photos. The server,
  // rather than the browser, authenticates the read before sending the PDF on.
  const result = await get(url, { access: 'private' })
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error('Could not read the uploaded PDF.')
  }
  const file = await client.files.create({
    file: await toFile(Buffer.from(await new Response(result.stream).arrayBuffer()), filename, { type: 'application/pdf' }),
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

async function extractFromImageUrl(url: string, contentType: string, prompt: string): Promise<ExtractedItinerary> {
  // Fetch Blob ourselves, then send the image bytes to vision. This avoids both
  // OpenAI's remote-URL fetch and its PDF-only file-input restriction.
  const res = await fetchBlob(url)
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
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

async function extractFromImageBase64(base64: string, contentType: string, prompt: string): Promise<ExtractedItinerary> {
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; base64?: string; blobUrl?: string; mediaType?: string; filename?: string; planning?: unknown; tripDestinations?: unknown }
    const tripDestinations = Array.isArray(body.tripDestinations)
      ? body.tripDestinations.filter((name): name is string => typeof name === 'string' && !!name.trim()).map(name => name.trim().slice(0, 160)).slice(0, 20) : []
    const prompt = extractPrompt(body.planning === true, tripDestinations)

    let extracted: ExtractedItinerary

    if (body.base64 && body.mediaType?.includes('wordprocessingml')) {
      // .docx sent as base64 — no Blob round-trip needed
      const buffer = Buffer.from(body.base64, 'base64')
      const result = await mammoth.extractRawText({ buffer })
      extracted = await extractFromText(result.value, prompt)
    } else if (body.base64 && body.mediaType?.startsWith('image/')) {
      extracted = await extractFromImageBase64(body.base64, body.mediaType, prompt)
    } else if (body.blobUrl && body.mediaType?.startsWith('image/')) {
      extracted = await extractFromImageUrl(body.blobUrl, body.mediaType, prompt)
    } else if (body.blobUrl && body.mediaType?.includes('pdf')) {
      extracted = await extractFromPrivatePdf(body.blobUrl, body.filename ?? 'itinerary.pdf', prompt)
    } else if (body.blobUrl) {
      // XLSX — fetch and parse to CSV text
      const res = await fetchBlob(body.blobUrl)
      const buffer = Buffer.from(await res.arrayBuffer())
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const text = workbook.SheetNames.map(name =>
        `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`
      ).join('\n\n')
      extracted = await extractFromText(text, prompt)
    } else if (body.text?.trim()) {
      extracted = await extractFromText(body.text, prompt)
    } else {
      return NextResponse.json({ error: 'No content provided.' }, { status: 400 })
    }

    return NextResponse.json(extracted)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[extract-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
