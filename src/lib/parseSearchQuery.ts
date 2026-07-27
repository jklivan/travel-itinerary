import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export type ParsedQuery = {
  audience: 'family' | 'adult' | null
  postType: 'guide' | null
  tags: string[]
  maxBudget: number | null
  locationTerms: string[]  // country/city names to OR-search across destinations
}

const TAG_IDS = [
  'adventure', 'beach', 'city', 'culture', 'food', 'hiking',
  'history', 'luxury', 'nature', 'nightlife', 'relaxing',
  'road-trip', 'romantic', 'shopping', 'wildlife',
]

export async function parseSearchQuery(query: string): Promise<ParsedQuery> {
  const fallback: ParsedQuery = {
    audience: null, postType: null, tags: [], maxBudget: null,
    locationTerms: [query],
  }

  if (!process.env.ANTHROPIC_API_KEY) return fallback

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Extract structured travel search filters from this query. Return only valid JSON, no explanation.

Query: "${query}"

Return a JSON object with these fields (omit or null if not mentioned):
- audience: "family" or "adult" (null if unspecified)
- postType: "guide" (only if user wants guides/recommendations, not trips; null otherwise)
- tags: array of matching tag IDs from this list: ${TAG_IDS.join(', ')}
- maxBudget: integer 1–5 (1=very cheap, 5=luxury; null if unspecified; infer from words like "budget", "cheap", "luxury", "splurge")
- locationTerms: array of specific country or city names to search for. If the user says a region like "Europe", expand to the most common European countries. If they say "Asia", expand to common Asian countries. Keep city names as-is.

Examples:
"family trip in europe" → {"audience":"family","postType":null,"tags":[],"maxBudget":null,"locationTerms":["France","Italy","Spain","Germany","Portugal","Greece","Netherlands","Austria","Croatia","Switzerland"]}
"cheap beach vacation" → {"audience":null,"postType":null,"tags":["beach"],"maxBudget":2,"locationTerms":[]}
"foodie guide to tokyo" → {"audience":null,"postType":"guide","tags":["food"],"maxBudget":null,"locationTerms":["Tokyo","Japan"]}
"romantic luxury trip" → {"audience":null,"postType":null,"tags":["romantic","luxury"],"maxBudget":5,"locationTerms":[]}`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const parsed = JSON.parse(text)
    return {
      audience: parsed.audience ?? null,
      postType: parsed.postType ?? null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: string) => TAG_IDS.includes(t)) : [],
      maxBudget: parsed.maxBudget ?? null,
      locationTerms: Array.isArray(parsed.locationTerms) ? parsed.locationTerms.filter(Boolean) : [],
    }
  } catch {
    return fallback
  }
}
