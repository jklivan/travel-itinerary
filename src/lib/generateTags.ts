import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const TAG_IDS = [
  'adventure', 'beach', 'city', 'culture', 'food', 'hiking',
  'history', 'luxury', 'nature', 'nightlife', 'relaxing',
  'road-trip', 'romantic', 'shopping', 'wildlife',
] as const

type Item = { type: string; name: string; notes: string | null }
type Dest = { name: string; country: string | null; items: Item[] }

export async function generateTags(
  tripTitle: string,
  destinations: Dest[],
  audience: string
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return []

  const destLines = destinations.length > 0
    ? destinations.map((d) => {
        const loc = `${d.name}${d.country ? `, ${d.country}` : ''}`
        const activities = d.items.filter((i) => i.type === 'activity').map((i) => i.name)
        const food = d.items.filter((i) => i.type === 'food_drink').map((i) => i.name)
        const hotel = d.items.find((i) => i.type === 'hotel')?.name
        const parts = []
        if (hotel) parts.push(`hotel: ${hotel}`)
        if (activities.length) parts.push(`activities: ${activities.join(', ')}`)
        if (food.length) parts.push(`food: ${food.join(', ')}`)
        return `${loc}${parts.length ? ' — ' + parts.join('; ') : ''}`
      }).join('\n')
    : '(no destination details)'

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      tools: [{
        name: 'set_tags',
        description: 'Set the tags for this travel itinerary based on its title, destinations, and activities.',
        input_schema: {
          type: 'object' as const,
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string', enum: TAG_IDS },
              minItems: 1,
              maxItems: 4,
              description: 'The 1–4 most fitting tag IDs for this trip.',
            },
          },
          required: ['tags'],
        },
      }],
      tool_choice: { type: 'tool', name: 'set_tags' },
      messages: [{
        role: 'user',
        content: `Tag this trip (audience: ${audience}):\nTitle: "${tripTitle}"\n${destLines}`,
      }],
    })

    const block = msg.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return []
    const input = block.input as { tags: string[] }
    return Array.isArray(input.tags) ? input.tags.filter((t) => (TAG_IDS as readonly string[]).includes(t)) : []
  } catch {
    return []
  }
}
