import OpenAI, { toFile } from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { get } from '@vercel/blob'

export const maxDuration = 300

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

type ExtractedItem = { type: string; name: string; notes: string; mealType?: string; rating?: number; link?: string; dayIndex?: number }
type ExtractedDest = { name: string; country: string; items: ExtractedItem[] }
type ExtractedItinerary = {
  title: string
  description?: string
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
                    type: { type: 'string', enum: ['hotel', 'activity', 'food_drink'] },
                    name: { type: 'string' },
                    notes: { type: 'string' },
                    mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] },
                    dayIndex: { type: 'integer', minimum: 1, description: 'Trip day number for dated restaurants or activities. Omit when no day is clear.' },
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
- For restaurants and activities with a clear date or day in the document, include dayIndex where 1 is the trip start date. Do not guess a day when the document does not establish one. Hotels are location-level stays: omit dayIndex for them.
- Rate 1–5 stars if any sentiment is expressed. Omit rating if none.
- Write notes for someone deciding whether they would want to stay there, do the activity, or visit the restaurant. Keep only concise, generally useful context such as what the experience includes, a notable feature, atmosphere, location context, or a broadly relevant dress code. Omit booking administration and traveller-specific logistics: confirmation numbers and dates, cancellation or payment terms, rates, contact details, check-in instructions, transport coordination, high-chair requests, seating requests (window/outdoor), dietary requests, and similar personal preferences.
- Populate startDate/endDate from the earliest and latest dates in the document (YYYY-MM-DD).
- Skip pure transportation (flights, transfers, shuttles).`

const PDF_JSON_INSTRUCTION = `Return only valid JSON in exactly this shape:
{"title":"","description":"","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","notes":"","destinations":[{"name":"","country":"","items":[{"type":"hotel|activity|food_drink","name":"","notes":"","dayIndex":1,"mealType":"breakfast|lunch|dinner|drinks|coffee|dessert|bakery","rating":1}]}]}.
Use an empty array for destinations only when the document contains no travel places.`

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

async function extractFromText(text: string): Promise<ExtractedItinerary> {
  const truncated = text.length > 20000 ? text.slice(0, 20000) + '\n[truncated]' : text
  const completion = await client.chat.completions.create({
    model: 'gpt-5.6-luna',
    reasoning_effort: 'none',
    tools: [EXTRACT_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
    messages: [{ role: 'user', content: `${EXTRACT_PROMPT}\n\nDOCUMENT:\n${truncated}` }],
  })
  return parseResult(completion)
}

async function extractFromPrivatePdf(url: string, filename: string): Promise<ExtractedItinerary> {
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
      model: 'gpt-5.6-luna',
      input: [{
        role: 'user',
        content: [
          { type: 'input_file', file_id: file.id },
          { type: 'input_text', text: `${EXTRACT_PROMPT}\n\n${PDF_JSON_INSTRUCTION}` },
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

async function extractFromImageUrl(url: string, contentType: string): Promise<ExtractedItinerary> {
  // Fetch Blob ourselves, then send the image bytes to vision. This avoids both
  // OpenAI's remote-URL fetch and its PDF-only file-input restriction.
  const res = await fetchBlob(url)
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
  const completion = await client.chat.completions.create({
    model: 'gpt-5.6-luna',
    reasoning_effort: 'none',
    tools: [EXTRACT_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } },
        { type: 'text', text: EXTRACT_PROMPT },
      ],
    }],
  })
  return parseResult(completion)
}

async function extractFromImageBase64(base64: string, contentType: string): Promise<ExtractedItinerary> {
  const completion = await client.chat.completions.create({
    model: 'gpt-5.6-luna',
    reasoning_effort: 'none',
    tools: [EXTRACT_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } },
        { type: 'text', text: EXTRACT_PROMPT },
      ],
    }],
  })
  return parseResult(completion)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; base64?: string; blobUrl?: string; mediaType?: string; filename?: string }

    let extracted: ExtractedItinerary

    if (body.base64 && body.mediaType?.includes('wordprocessingml')) {
      // .docx sent as base64 — no Blob round-trip needed
      const buffer = Buffer.from(body.base64, 'base64')
      const result = await mammoth.extractRawText({ buffer })
      extracted = await extractFromText(result.value)
    } else if (body.base64 && body.mediaType?.startsWith('image/')) {
      extracted = await extractFromImageBase64(body.base64, body.mediaType)
    } else if (body.blobUrl && body.mediaType?.startsWith('image/')) {
      extracted = await extractFromImageUrl(body.blobUrl, body.mediaType)
    } else if (body.blobUrl && body.mediaType?.includes('pdf')) {
      extracted = await extractFromPrivatePdf(body.blobUrl, body.filename ?? 'itinerary.pdf')
    } else if (body.blobUrl) {
      // XLSX — fetch and parse to CSV text
      const res = await fetchBlob(body.blobUrl)
      const buffer = Buffer.from(await res.arrayBuffer())
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const text = workbook.SheetNames.map(name =>
        `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`
      ).join('\n\n')
      extracted = await extractFromText(text)
    } else if (body.text?.trim()) {
      extracted = await extractFromText(body.text)
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
