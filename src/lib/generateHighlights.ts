import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

type Item = {
  type: string
  name: string
  rating: number | null
  notes: string | null
  mealType?: string | null
}

type Dest = {
  name: string
  country: string | null
  items: Item[]
}

export async function generateHighlights(
  tripTitle: string,
  destinations: Dest[]
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const topItems = destinations.flatMap((d) =>
    d.items
      .filter((i) => i.rating === 5)
      .map((i) => {
        const verb = i.type === 'hotel' ? 'stayed at' : i.type === 'food_drink' ? 'ate at' : 'visited'
        const loc = `${d.name}${d.country ? `, ${d.country}` : ''}`
        return `${verb} ${i.name} in ${loc}${i.notes ? ` (${i.notes})` : ''}`
      })
  )

  if (topItems.length === 0) return null

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 160,
      messages: [
        {
          role: 'user',
          content: `Write 2 warm, first-person sentences summarising the best moments of a trip called "${tripTitle}". Draw only from these top-rated experiences: ${topItems.join('; ')}. Past tense, conversational, no bullet points, no intro phrase like "Sure" or "Here is".`,
        },
      ],
    })
    const block = msg.content[0]
    return block.type === 'text' ? block.text.trim() : null
  } catch {
    return null
  }
}
