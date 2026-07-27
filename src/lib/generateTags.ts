import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const TAG_IDS = [
  'adventure', 'beach', 'city', 'culture', 'food', 'hiking',
  'history', 'luxury', 'nature', 'nightlife', 'relaxing',
  'road-trip', 'romantic', 'shopping', 'wildlife',
]

type Item = { type: string; name: string; notes: string | null }
type Dest = { name: string; country: string | null; items: Item[] }

export async function generateTags(
  tripTitle: string,
  destinations: Dest[],
  audience: string
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return []

  const destLines = destinations.map((d) => {
    const loc = `${d.name}${d.country ? `, ${d.country}` : ''}`
    const activities = d.items.filter((i) => i.type === 'activity').map((i) => i.name)
    const food = d.items.filter((i) => i.type === 'food_drink').map((i) => i.name)
    const hotel = d.items.find((i) => i.type === 'hotel')?.name
    const parts = []
    if (hotel) parts.push(`stayed at ${hotel}`)
    if (activities.length) parts.push(`activities: ${activities.join(', ')}`)
    if (food.length) parts.push(`ate at: ${food.join(', ')}`)
    return `${loc} — ${parts.join('; ') || 'no details'}`
  })

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Pick the most fitting tags for this travel itinerary. Return ONLY a JSON array of tag IDs, nothing else.

Available tags: ${TAG_IDS.join(', ')}

Trip: "${tripTitle}" (audience: ${audience})
${destLines.join('\n')}

Return 1–4 tags that best match. Example: ["beach","relaxing"]`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.filter((t: string) => TAG_IDS.includes(t)) : []
  } catch {
    return []
  }
}
