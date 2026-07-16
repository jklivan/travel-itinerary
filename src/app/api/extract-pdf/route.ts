import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string }
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided.' }, { status: 400 })
    }

    // ── Step 1: extract itinerary structure ─────────────────────────────────
    const extraction = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      tools: [
        {
          name: 'extract_itinerary',
          description:
            'Extract the actual itinerary data. Only include things explicitly stated as part of the trip.',
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
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_itinerary' },
      messages: [
        {
          role: 'user',
          content: `Extract the actual itinerary from this document.

RULES:
- Only extract confirmed trip items, not suggestions or recommendations.
- Do NOT extract specific calendar dates or times — use relative labels like "Day 1" in notes if relevant.
- Do NOT populate startDate or endDate.
- Classify as "activity" for sightseeing/experiences, "food_drink" for restaurants/bars/cafes.
- Set "notes" to empty string if no notes exist for an item.

DOCUMENT:
${text}`,
        },
      ],
    })

    const extractBlock = extraction.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'extract_itinerary'
    )
    if (!extractBlock) {
      return NextResponse.json({ error: 'Could not extract itinerary.' }, { status: 422 })
    }

    const extracted = extractBlock.input as ExtractedItinerary

    return NextResponse.json(extracted)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[extract-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
