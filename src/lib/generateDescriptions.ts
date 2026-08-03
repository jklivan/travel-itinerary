import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

type PlaceInput = {
  id: string
  name: string
  type: 'hotel' | 'food_drink'
  destination: string
  mealType?: string | null
  priceLevel?: number | null
}

export async function generateDescriptions(places: PlaceInput[]): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>()
  if (!process.env.ANTHROPIC_API_KEY || places.length === 0) return descriptions

  const list = places.map((p, i) => {
    const kind = p.type === 'hotel' ? 'hotel' : 'restaurant/bar'
    const parts = [`${kind} in ${p.destination}`]
    if (p.mealType) parts.push(`known for ${p.mealType}`)
    if (p.priceLevel) {
      const tiers = p.type === 'hotel'
        ? ['budget', 'mid-range', 'upscale', 'luxury', 'ultra-luxury']
        : ['budget', 'moderate', 'upscale', 'fine dining']
      parts.push(`${tiers[(p.priceLevel - 1)] ?? ''} price range`)
    }
    return `${i + 1}. "${p.name}" — ${parts.join(', ')}`
  }).join('\n')

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [{
        name: 'set_descriptions',
        description: 'Set short descriptions for a list of hotels and restaurants.',
        input_schema: {
          type: 'object' as const,
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number', description: '1-based index from the input list' },
                  description: { type: 'string', description: 'A 1-2 sentence description. Be specific and evocative — mention cuisine type, ambiance, or what the place is known for. Max 150 characters.' },
                },
                required: ['index', 'description'],
              },
            },
          },
          required: ['items'],
        },
      }],
      tool_choice: { type: 'tool', name: 'set_descriptions' },
      messages: [{
        role: 'user',
        content: `Write a short 1-2 sentence description for each place. Be specific and evocative — mention cuisine, ambiance, or what the place is best known for. If you have no knowledge of a specific place, write a plausible description based on its name and type. Keep each description under 150 characters.\n\n${list}`,
      }],
    })

    const block = msg.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return descriptions
    const input = block.input as { items: { index: number; description: string }[] }
    for (const { index, description } of input.items) {
      const place = places[index - 1]
      if (place && description?.trim()) descriptions.set(place.id, description.trim())
    }
  } catch { /* ignore */ }

  return descriptions
}
