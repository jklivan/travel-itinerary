import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export type ParsedQuery = {
  audience: 'family' | 'adult' | null
  postType: 'guide' | null
  tags: string[]
  maxBudget: number | null
  locationTerms: string[]
}

const TAG_IDS = [
  'adventure', 'beach', 'city', 'culture', 'food', 'hiking',
  'history', 'luxury', 'nature', 'nightlife', 'relaxing',
  'road-trip', 'romantic', 'shopping', 'wildlife',
]

// Empty fallback — no filters means show everything rather than a broken search
const EMPTY: ParsedQuery = { audience: null, postType: null, tags: [], maxBudget: null, locationTerms: [] }

export async function parseSearchQuery(query: string): Promise<ParsedQuery> {
  if (!process.env.ANTHROPIC_API_KEY) return EMPTY

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are extracting travel search filters. Return ONLY a raw JSON object — no explanation, no markdown, no code fences.

Fields to extract:
- "audience": "family" or "adult" — only if explicitly mentioned (null otherwise)
- "postType": "guide" — only if the user wants recommendations/guides rather than personal trip stories (null otherwise)
- "tags": array of tag IDs that match the vibe. Choose from: ${TAG_IDS.join(', ')}
- "maxBudget": 1–5 integer (1=backpacker, 3=mid-range, 5=luxury). Infer from words like budget/cheap/affordable/luxury/splurge. null if unclear.
- "locationTerms": THIS IS THE MOST IMPORTANT FIELD. Include every country and city that is mentioned or clearly implied:
    • Named countries → include them directly (e.g. "France", "Japan")
    • Named cities → include the city AND its country (e.g. "Tokyo", "Japan")
    • Named regions/areas → expand to their component countries:
        Europe → France, Italy, Spain, Germany, Portugal, Greece, Netherlands, Austria, Croatia, Switzerland, UK, Ireland, Belgium, Denmark, Sweden, Norway
        Southeast Asia → Thailand, Vietnam, Indonesia, Philippines, Malaysia, Singapore, Cambodia
        Asia → Japan, China, South Korea, Thailand, Vietnam, Indonesia, India
        Caribbean → Dominican Republic, Jamaica, Bahamas, Cuba, Barbados, Saint Lucia
        Latin America → Mexico, Colombia, Peru, Argentina, Brazil, Chile, Costa Rica
        Middle East → UAE, Israel, Jordan, Turkey, Morocco
    • Implied locations (e.g. "safari" implies Kenya, Tanzania, South Africa; "Alps" implies Switzerland, Austria, France)
    • If no location is mentioned or implied, return []

Input: ${query}`,
      }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    console.log('[parseSearch] raw:', text)
    const parsed = JSON.parse(text)
    return {
      audience: parsed.audience ?? null,
      postType: parsed.postType ?? null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: string) => TAG_IDS.includes(t)) : [],
      maxBudget: parsed.maxBudget ?? null,
      locationTerms: Array.isArray(parsed.locationTerms) ? parsed.locationTerms.filter(Boolean) : [],
    }
  } catch (err) {
    console.error('[parseSearch] parse failed:', err)
    return EMPTY
  }
}
