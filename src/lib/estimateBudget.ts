import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

type Dest = { name: string; country: string | null; items: { type: string; name: string }[] }

// How pricey a trip is, $ to $$$$$ (1-5), from where it stayed and ate: for trips posted without a budget, so every
// card in the feed shows a price guide. Null when there's nothing to go on or the AI isn't available.
export async function estimateBudget(title: string, destinations: Dest[]): Promise<number | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const lines = destinations.map(d => {
    const hotels = d.items.filter(i => i.type === 'hotel').map(i => i.name)
    const food = d.items.filter(i => i.type === 'food_drink').map(i => i.name).slice(0, 12)
    const things = d.items.filter(i => i.type === 'activity').map(i => i.name).slice(0, 8)
    return `${d.name}${d.country ? `, ${d.country}` : ''}${hotels.length ? ` — stayed: ${hotels.join(', ')}` : ''}${food.length ? `; ate: ${food.join(', ')}` : ''}${things.length ? `; did: ${things.join(', ')}` : ''}`
  }).filter(Boolean)
  if (!destinations.some(d => d.items.some(i => i.type === 'hotel' || i.type === 'food_drink'))) return null
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      tools: [{
        name: 'set_budget',
        description: 'Set how expensive this trip is, from the hotels and restaurants it used.',
        input_schema: { type: 'object' as const, properties: { budget: { type: 'integer', minimum: 1, maximum: 5, description: '1 = budget ($), 2 = moderate, 3 = mid-range, 4 = upscale, 5 = luxury ($$$$$)' } }, required: ['budget'] },
      }],
      tool_choice: { type: 'tool', name: 'set_budget' },
      messages: [{ role: 'user', content: `Price level of this trip, judged mostly by its hotels (then restaurants):\nTitle: "${title}"\n${lines.join('\n')}` }],
    })
    const block = message.content.find(b => b.type === 'tool_use')
    const budget = block && block.type === 'tool_use' ? Number((block.input as { budget?: unknown }).budget) : NaN
    return Number.isInteger(budget) && budget >= 1 && budget <= 5 ? budget : null
  } catch { return null }
}
