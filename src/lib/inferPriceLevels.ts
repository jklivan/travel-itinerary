import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

type PlaceInput = { id: string; name: string; type: 'hotel' | 'food_drink'; destination: string }

export async function inferPriceLevels(places: PlaceInput[]): Promise<Map<string, number>> {
  const results = new Map<string, number>()
  if (!process.env.ANTHROPIC_API_KEY || places.length === 0) return results

  const list = places.map((p, i) =>
    `${i + 1}. "${p.name}" — ${p.type === 'hotel' ? 'hotel' : 'restaurant/bar'} in ${p.destination}`
  ).join('\n')

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      tools: [{
        name: 'set_price_levels',
        description: 'Set price levels (1–4) for a list of hotels and restaurants based on general knowledge.',
        input_schema: {
          type: 'object' as const,
          properties: {
            levels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number', description: '1-based index from the input list' },
                  level: { type: 'number', enum: [1, 2, 3, 4], description: '1=$, 2=$$, 3=$$$, 4=$$$$' },
                },
                required: ['index', 'level'],
              },
              description: 'Price level for each place. Omit any place you have no knowledge of.',
            },
          },
          required: ['levels'],
        },
      }],
      tool_choice: { type: 'tool', name: 'set_price_levels' },
      messages: [{
        role: 'user',
        content: `Estimate price level (1=budget, 2=moderate, 3=upscale, 4=luxury) for each place based on your knowledge. Only include entries you're confident about.\n\n${list}`,
      }],
    })

    const block = msg.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return results
    const input = block.input as { levels: { index: number; level: number }[] }
    for (const { index, level } of input.levels) {
      const place = places[index - 1]
      if (place && level >= 1 && level <= 4) results.set(place.id, level)
    }
  } catch { /* ignore */ }

  return results
}
