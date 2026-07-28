import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

type PlaceInput = { id: string; name: string; type: 'hotel' | 'food_drink'; destination: string }

export type InferResult = {
  priceLevels: Map<string, number>
  familyFriendly: Map<string, boolean>
  error?: string
  stopReason?: string | null
}

export async function inferPlaceAttributes(places: PlaceInput[]): Promise<InferResult> {
  const priceLevels = new Map<string, number>()
  const familyFriendly = new Map<string, boolean>()
  if (!process.env.ANTHROPIC_API_KEY || places.length === 0) {
    return { priceLevels, familyFriendly, error: 'No API key or empty input' }
  }

  const list = places.map((p, i) =>
    `${i + 1}. "${p.name}" — ${p.type === 'hotel' ? 'hotel' : 'restaurant/bar'} in ${p.destination}`
  ).join('\n')

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [{
        name: 'set_attributes',
        description: 'Set price levels and family-friendliness for a list of hotels and restaurants.',
        input_schema: {
          type: 'object' as const,
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number', description: '1-based index from the input list' },
                  level: { type: 'number', enum: [1, 2, 3, 4, 5], description: 'Hotels: 1=budget(<$150/night), 2=mid($150-350), 3=upscale($350-600), 4=luxury($600-1000), 5=ultra-luxury($1000+). Restaurants: 1=budget, 2=moderate, 3=upscale, 4=luxury.' },
                  familyFriendly: { type: 'boolean', description: 'Restaurants only: true if welcoming to children (not primarily a bar or nightclub). Default to true for casual and mid-range restaurants unless there is a clear reason not to. Omit for hotels.' },
                },
                required: ['index', 'level'],
              },
              description: 'Attributes for each place. Omit any place you have no knowledge of.',
            },
          },
          required: ['items'],
        },
      }],
      tool_choice: { type: 'tool', name: 'set_attributes' },
      messages: [{
        role: 'user',
        content: `Estimate attributes for each place. Hotels: price level 1=budget(<$150/night) to 5=ultra-luxury($1000+/night). Restaurants: price level 1=budget to 4=luxury, plus whether they are family-friendly (welcoming to children, not primarily a bar or nightclub). Default to true for casual and mid-range restaurants unless there's a clear reason not to. Only omit entries you have no knowledge of at all.\n\n${list}`,
      }],
    })

    const block = msg.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return { priceLevels, familyFriendly, error: 'No tool_use block', stopReason: msg.stop_reason }
    }
    const input = block.input as { items: { index: number; level: number; familyFriendly?: boolean }[] }
    for (const { index, level, familyFriendly: ff } of input.items) {
      const place = places[index - 1]
      if (!place) continue
      const maxLevel = place.type === 'hotel' ? 5 : 4
      if (level >= 1 && level <= maxLevel) priceLevels.set(place.id, level)
      if (place.type === 'food_drink' && ff !== undefined) familyFriendly.set(place.id, ff)
    }
    return { priceLevels, familyFriendly, stopReason: msg.stop_reason }
  } catch (e) {
    return { priceLevels, familyFriendly, error: String(e) }
  }
}

// Backwards-compat shim used by the backfill admin route
export async function inferPriceLevels(places: PlaceInput[]): Promise<{ results: Map<string, number>; error?: string; stopReason?: string | null }> {
  const { priceLevels, error, stopReason } = await inferPlaceAttributes(places)
  return { results: priceLevels, error, stopReason }
}
