import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export type ParsedQuery = {
  audience: 'family' | 'adult' | 'friends' | 'romantic' | null
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

const EMPTY: ParsedQuery = { audience: null, postType: null, tags: [], maxBudget: null, locationTerms: [] }

export async function parseSearchQuery(query: string): Promise<ParsedQuery> {
  if (!process.env.ANTHROPIC_API_KEY) return EMPTY

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      tools: [{
        name: 'extract_filters',
        description: 'Extract structured travel search filters from a natural language query.',
        input_schema: {
          type: 'object' as const,
          properties: {
            audience: {
              type: 'string',
              enum: ['family', 'adult', 'friends', 'romantic'],
              description: 'Target audience — only set if explicitly mentioned.',
            },
            postType: {
              type: 'string',
              enum: ['guide'],
              description: 'Set to "guide" only if the user wants recommendation guides, not personal trip stories.',
            },
            tags: {
              type: 'array',
              items: { type: 'string', enum: TAG_IDS },
              description: 'Tags that match the trip vibe.',
            },
            maxBudget: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: '1=backpacker, 3=mid-range, 5=luxury. Infer from words like budget/cheap/luxury/splurge.',
            },
            locationTerms: {
              type: 'array',
              items: { type: 'string' },
              description: `Every country and city mentioned or clearly implied. Rules:
- Named country → include it (e.g. "France")
- Named city → include city AND its country (e.g. ["Tokyo", "Japan"])
- Europe → France, Italy, Spain, Germany, Portugal, Greece, Netherlands, Austria, Croatia, Switzerland, UK, Ireland
- Southeast Asia → Thailand, Vietnam, Indonesia, Philippines, Malaysia, Singapore, Cambodia
- Asia → Japan, China, South Korea, Thailand, Vietnam, Indonesia, India
- Caribbean → Dominican Republic, Jamaica, Bahamas, Cuba, Barbados, Saint Lucia
- Latin America → Mexico, Colombia, Peru, Argentina, Brazil, Chile, Costa Rica
- Middle East → UAE, Israel, Jordan, Turkey, Morocco
- Implied: "safari" → Kenya, Tanzania, South Africa; "Alps" → Switzerland, Austria, France; "Amalfi" → Italy
- No location mentioned → empty array`,
            },
          },
          required: ['tags', 'locationTerms'],
        },
      }],
      tool_choice: { type: 'tool', name: 'extract_filters' },
      messages: [{ role: 'user', content: query }],
    })

    const block = msg.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return EMPTY

    const input = block.input as Record<string, unknown>
    console.log('[parseSearch] extracted:', JSON.stringify(input))

    return {
      audience: (input.audience as 'family' | 'adult' | 'friends' | 'romantic') ?? null,
      postType: (input.postType as 'guide') ?? null,
      tags: Array.isArray(input.tags) ? (input.tags as string[]).filter((t) => TAG_IDS.includes(t)) : [],
      maxBudget: typeof input.maxBudget === 'number' ? input.maxBudget : null,
      locationTerms: Array.isArray(input.locationTerms) ? (input.locationTerms as string[]).filter(Boolean) : [],
    }
  } catch (err) {
    console.error('[parseSearch] failed:', err)
    return EMPTY
  }
}
