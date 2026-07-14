import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json() as { url?: string }
    if (!url) {
      return NextResponse.json({ error: 'A PDF URL is required.' }, { status: 400 })
    }

    // Fetch the PDF from Vercel Blob server-side and convert to base64
    const pdfRes = await fetch(url)
    if (!pdfRes.ok) {
      return NextResponse.json({ error: 'Could not fetch PDF from storage.' }, { status: 502 })
    }
    const pdfBuffer = await pdfRes.arrayBuffer()
    const base64 = Buffer.from(pdfBuffer).toString('base64')

    const documentBlock: Anthropic.DocumentBlockParam = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      tools: [
        {
          name: 'extract_itinerary',
          description:
            'Extract the actual itinerary data from the document. Only include items that are explicitly stated as part of the trip — do NOT invent, suggest, or recommend anything.',
          input_schema: {
            type: 'object' as const,
            properties: {
              title: {
                type: 'string',
                description: 'Trip title, e.g. "2 weeks in Japan"',
              },
              description: {
                type: 'string',
                description: 'Short description of the trip (1-2 sentences), if found',
              },
              startDate: {
                type: 'string',
                description: 'Trip start date in YYYY-MM-DD format, if found',
              },
              endDate: {
                type: 'string',
                description: 'Trip end date in YYYY-MM-DD format, if found',
              },
              budget: {
                type: 'number',
                description: 'Total budget as a number, if explicitly stated',
              },
              currency: {
                type: 'string',
                description: 'Currency code (USD, EUR, etc.), if explicitly stated',
              },
              notes: {
                type: 'string',
                description:
                  'General trip notes, tips, or packing info explicitly in the document',
              },
              destinations: {
                type: 'array',
                description: 'Ordered list of destinations visited',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'City or place name' },
                    country: { type: 'string', description: 'Country name, if stated' },
                    items: {
                      type: 'array',
                      description: 'Activities and food/drink places for this destination',
                      items: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['activity', 'food_drink'],
                            description:
                              '"activity" for sightseeing/experiences, "food_drink" for restaurants/bars/cafes',
                          },
                          name: {
                            type: 'string',
                            description: 'Name of the activity or place',
                          },
                          notes: {
                            type: 'string',
                            description: 'Any notes about this item from the document',
                          },
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
          content: [
            documentBlock,
            {
              type: 'text',
              text: `Extract the actual itinerary from this PDF.

CRITICAL RULES:
- Only extract things that are CONFIRMED as part of this specific trip (places visited, activities done or planned, restaurants/bars explicitly mentioned).
- Do NOT add suggestions, recommendations, or anything phrased as "you could", "consider visiting", "alternatively", or similar.
- If a date, budget, or currency is not stated, omit that field entirely.
- For items: classify as "activity" if it is sightseeing, an experience, transport, or an event; classify as "food_drink" if it is a restaurant, cafe, bar, market, or food experience.
- Set "notes" to an empty string if there are no notes for that item.
- If the document contains no recognisable itinerary, return a title like "Untitled Trip" and an empty destinations array.`,
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json(
        { error: 'Could not extract itinerary from the PDF.' },
        { status: 422 }
      )
    }

    return NextResponse.json(toolUse.input)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[extract-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
