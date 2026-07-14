import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json() as { text?: string }
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided.' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      tools: [
        {
          name: 'extract_itinerary',
          description:
            'Extract the actual itinerary data from the document. Only include items explicitly stated as part of the trip.',
          input_schema: {
            type: 'object' as const,
            properties: {
              title: { type: 'string', description: 'Trip title' },
              description: { type: 'string', description: 'Short description, if found' },
              startDate: { type: 'string', description: 'Start date in YYYY-MM-DD, if found' },
              endDate: { type: 'string', description: 'End date in YYYY-MM-DD, if found' },
              budget: { type: 'number', description: 'Total budget number, if stated' },
              currency: { type: 'string', description: 'Currency code e.g. USD, if stated' },
              notes: { type: 'string', description: 'General trip notes explicitly in the document' },
              destinations: {
                type: 'array',
                description: 'Ordered list of destinations',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'City or place name' },
                    country: { type: 'string', description: 'Country, if stated' },
                    items: {
                      type: 'array',
                      description: 'Activities and food/drink at this destination',
                      items: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['activity', 'food_drink'],
                            description: '"activity" for sightseeing/experiences, "food_drink" for restaurants/bars/cafes',
                          },
                          name: { type: 'string', description: 'Name of the activity or place' },
                          notes: { type: 'string', description: 'Any notes from the document, or empty string' },
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
          content: `Extract the actual itinerary from this document text.

CRITICAL RULES:
- Only extract things CONFIRMED as part of this specific trip.
- Do NOT add suggestions or recommendations not in the text.
- If dates, budget, or currency are not stated, omit those fields.
- Classify as "activity" for sightseeing/experiences, "food_drink" for restaurants/bars/cafes.
- Set "notes" to empty string if no notes for that item.

DOCUMENT TEXT:
${text}`,
        },
      ],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'Could not extract itinerary.' }, { status: 422 })
    }

    return NextResponse.json(toolUse.input)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[extract-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
