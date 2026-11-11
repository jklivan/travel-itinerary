import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

type Trip = { title: string; notes: string | null; joined: number; places: { type: string; name: string; notes: string | null }[] }

// For trips still marked "Adults" (from before Solo): was it a couple or friends? The AI reads the trip's title, notes
// and places; the admin page shows its answer and reason to apply or change.
export async function coupleOrFriends(trip: Trip): Promise<{ audience: 'romantic' | 'friends'; reason: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const places = trip.places.slice(0, 40).map(place => `- [${place.type}] ${place.name}${place.notes ? ` — ${place.notes.slice(0, 160).replace(/\s+/g, ' ')}` : ''}`).join('\n')
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 200,
      tools: [{ name: 'set_group', description: 'Say whether this adults-only trip was a couple (two people) or friends (a group).', input_schema: { type: 'object' as const, properties: {
        audience: { type: 'string', enum: ['romantic', 'friends'], description: 'romantic = a couple; friends = a group of friends' },
        reason: { type: 'string', description: 'One short sentence: the clue that decided it.' } }, required: ['audience', 'reason'] } }],
      tool_choice: { type: 'tool', name: 'set_group' },
      messages: [{ role: 'user', content: `An adults-only trip. Was it a couple or a group of friends?\nTitle: "${trip.title}"\nPeople who joined the plan besides the creator: ${trip.joined}\nTrip notes: ${(trip.notes ?? '').slice(0, 600) || '(none)'}\nPlaces:\n${places || '(none)'}` }],
    })
    const block = message.content.find(b => b.type === 'tool_use')
    const input = block && block.type === 'tool_use' ? block.input as { audience?: string; reason?: string } : null
    return input && (input.audience === 'romantic' || input.audience === 'friends') ? { audience: input.audience, reason: String(input.reason ?? '').slice(0, 200) } : null
  } catch { return null }
}
