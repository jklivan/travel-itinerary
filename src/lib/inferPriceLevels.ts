import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

type PlaceInput = { id: string; name: string; type: 'hotel' | 'food_drink'; destination: string }

export async function inferPriceLevels(
  places: PlaceInput[]
): Promise<{ results: Map<string, number>; error?: string; stopReason?: string | null }> {
  const results = new Map<string, number>()
  if (!process.env.ANTHROPIC_API_KEY || places.length === 0) {
    return { results, error: 'No API key or empty input' }
  }

  const list = places.map((p, i) =>
    `${i + 1}. "${p.name}" — ${p.type === 'hotel' ? 'hotel' : 'restaurant/bar'} in ${p.destination}`
  ).join('\n')

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [{
        name: 'set_price_levels',
        description: 'Set price levels for a list of hotels and restaurants based on general knowledge. Hotels use 1–5 scale; restaurants use 1–4 scale.',
        input_schema: {
          type: 'object' as const,
          properties: {
            levels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number', description: '1-based index from the input list' },
                  level: { type: 'number', enum: [1, 2, 3, 4, 5], description: 'Hotels: 1=budget(<$150/night), 2=mid($150-350), 3=upscale($350-600), 4=luxury($600-1000), 5=ultra-luxury($1000+). Restaurants: 1=budget, 2=moderate, 3=upscale, 4=luxury.' },
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
        content: `Estimate price level for each place. Hotels: 1=budget(<$150/night), 2=mid($150-350), 3=upscale($350-600), 4=luxury($600-1000), 5=ultra-luxury($1000+/night). Restaurants: 1=budget, 2=moderate, 3=upscale, 4=luxury. Only include entries you're confident about.\n\n${list}`,
      }],
    })

    const block = msg.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return { results, error: 'No tool_use block', stopReason: msg.stop_reason }
    }
    const input = block.input as { levels: { index: number; level: number }[] }
    for (const { index, level } of input.levels) {
      const place = places[index - 1]
      const maxLevel = place?.type === 'hotel' ? 5 : 4
      if (place && level >= 1 && level <= maxLevel) results.set(place.id, level)
    }
    return { results, stopReason: msg.stop_reason }
  } catch (e) {
    return { results, error: String(e) }
  }
}
