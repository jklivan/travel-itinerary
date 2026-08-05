import OpenAI, { toFile } from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const maxDuration = 300

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

type ExtractedItem = { type: string; name: string; notes: string; mealType?: string; rating?: number; link?: string }
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

const EXTRACT_PROMPT = `You are extracting travel data from a document. The document can be anything travel-related: an itinerary, booking confirmations, reservation emails, hotel folios, notes, screenshots — anything. Extract every place, stay, meal, and experience that would belong in a travel itinerary.

- Classify each item as "hotel" (any accommodation), "food_drink" (any restaurant, bar, cafe, dining reservation), or "activity" (anything else: tours, sights, spa, experiences).
- For food_drink, infer mealType from the time if given: before 11am = breakfast, 11am–3pm = lunch, 3pm–6pm = drinks or coffee, after 6pm = dinner. Otherwise pick the best fit.
- Rate 1–5 stars if any sentiment is expressed. Omit rating if none.
- Put useful details (confirmation numbers, dress codes, notes) in the notes field.
- Populate startDate/endDate from the earliest and latest dates in the document (YYYY-MM-DD).
- Skip pure transportation (flights, transfers, shuttles).`

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
    tools: [EXTRACT_FUNCTION],
    tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
    messages: [{ role: 'user', content: `${EXTRACT_PROMPT}\n\nDOCUMENT:\n${truncated}` }],
  })
  return parseResult(completion)
}

async function extractFromUploadedFile(
  url: string,
  filename: string,
  contentType: string,
): Promise<ExtractedItinerary> {
  // Upload to OpenAI first. Passing a Vercel Blob URL directly makes the model
  // fetch the image itself, which can stall on remote-object retrieval.
  const res = await fetchBlob(url)
  const file = await client.files.create({
    file: await toFile(Buffer.from(await res.arrayBuffer()), filename, { type: contentType }),
    purpose: 'user_data',
  })

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-5.6-luna',
      tools: [EXTRACT_FUNCTION],
      tool_choice: { type: 'function', function: { name: 'extract_itinerary' } },
      messages: [{
        role: 'user',
        content: [
          { type: 'file', file: { file_id: file.id } },
          { type: 'text', text: EXTRACT_PROMPT },
        ],
      }],
    })
    return parseResult(completion)
  } finally {
    await client.files.delete(file.id).catch(() => undefined)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; blobUrl?: string; mediaType?: string; filename?: string }

    let extracted: ExtractedItinerary

    if (body.blobUrl && body.mediaType?.startsWith('image/')) {
      extracted = await extractFromUploadedFile(
        body.blobUrl,
        body.filename ?? 'itinerary-image',
        body.mediaType,
      )
    } else if (body.blobUrl && body.mediaType?.includes('pdf')) {
      extracted = await extractFromUploadedFile(
        body.blobUrl,
        body.filename ?? 'itinerary.pdf',
        body.mediaType,
      )
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
