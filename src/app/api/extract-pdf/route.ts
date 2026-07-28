import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type ExtractedItem = { type: string; name: string; notes: string; link?: string }
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

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_itinerary',
  description: 'Extract the actual itinerary data. Only include things explicitly stated as part of the trip.',
  input_schema: {
    type: 'object' as const,
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
                  type: { type: 'string', enum: ['activity', 'food_drink'] },
                  name: { type: 'string' },
                  notes: { type: 'string' },
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
}

const EXTRACT_PROMPT = `Extract the actual itinerary from this document.

RULES:
- Only extract confirmed trip items, not suggestions or recommendations.
- Do NOT extract specific calendar dates or times — use relative labels like "Day 1" in notes if relevant.
- Do NOT populate startDate or endDate.
- Classify as "activity" for sightseeing/experiences, "food_drink" for restaurants/bars/cafes.
- Set "notes" to empty string if no notes exist for an item.
- Do NOT include transportation logistics: skip anything that is purely about pick-up, drop-off, transfers, airport/hotel shuttles, departure/arrival times, or transit between locations. Only include destinations and things to do, eat, or stay at those destinations.`

async function extractFromText(text: string): Promise<ExtractedItinerary> {
  const truncated = text.length > 20000 ? text.slice(0, 20000) + '\n[truncated]' : text
  const extraction = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_itinerary' },
    messages: [{ role: 'user', content: `${EXTRACT_PROMPT}\n\nDOCUMENT:\n${truncated}` }],
  })
  const block = extraction.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!block) throw new Error('Could not extract itinerary.')
  return block.input as ExtractedItinerary
}

async function extractFromPdf(base64: string): Promise<ExtractedItinerary> {
  const extraction = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_itinerary' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as Anthropic.DocumentBlockParam,
        { type: 'text', text: EXTRACT_PROMPT },
      ],
    }],
  })
  const block = extraction.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!block) throw new Error('Could not extract itinerary.')
  return block.input as ExtractedItinerary
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; base64?: string; mediaType?: string }

    let extracted: ExtractedItinerary

    if (body.base64 && body.mediaType?.includes('pdf')) {
      // PDF — send directly to Claude as a document
      extracted = await extractFromPdf(body.base64)
    } else if (body.base64) {
      // XLSX / other binary — parse to CSV on server then extract
      const buffer = Buffer.from(body.base64, 'base64')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const text = workbook.SheetNames.map(name =>
        `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`
      ).join('\n\n')
      extracted = await extractFromText(text)
    } else if (body.text?.trim()) {
      // Plain text / CSV / paste
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
