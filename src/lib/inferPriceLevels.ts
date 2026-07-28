import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? '' })

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
  if (!process.env.GOOGLE_API_KEY || places.length === 0) {
    return { priceLevels, familyFriendly, error: 'No API key or empty input' }
  }

  const list = places
    .map(
      (p, i) =>
        `${i + 1}. "${p.name}" — ${p.type === 'hotel' ? 'hotel' : 'restaurant/bar'} in ${p.destination}`
    )
    .join('\n')

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Estimate attributes for each place. Hotels: price level 1=budget(<$150/night) to 5=ultra-luxury($1000+/night). Restaurants: price level 1=budget to 4=luxury, plus whether they are family-friendly (kid-friendly, casual dining — not bars, clubs, or fine dining). Only include entries you're confident about.\n\n${list}`,
      config: {
        tools: [
          {
            functionDeclarations: [
              {
                name: 'set_attributes',
                description:
                  'Set price levels and family-friendliness for a list of hotels and restaurants.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          index: {
                            type: Type.NUMBER,
                            description: '1-based index from the input list',
                          },
                          level: {
                            type: Type.NUMBER,
                            description:
                              'Hotels: 1=budget(<$150/night), 2=mid($150-350), 3=upscale($350-600), 4=luxury($600-1000), 5=ultra-luxury($1000+). Restaurants: 1=budget, 2=moderate, 3=upscale, 4=luxury.',
                          },
                          familyFriendly: {
                            type: Type.BOOLEAN,
                            description:
                              'Restaurants only: true if the place is generally considered family-friendly (kid-friendly menu, casual, not a bar/club). Omit for hotels.',
                          },
                        },
                        required: ['index', 'level'],
                      },
                      description: 'Attributes for each place. Omit any place you have no knowledge of.',
                    },
                  },
                  required: ['items'],
                },
              },
            ],
          },
        ],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['set_attributes'] } },
      },
    })

    const call = response.functionCalls?.[0]
    if (!call) {
      return { priceLevels, familyFriendly, error: 'No function call in response', stopReason: response.candidates?.[0]?.finishReason }
    }

    const args = call.args as { items: { index: number; level: number; familyFriendly?: boolean }[] }
    for (const { index, level, familyFriendly: ff } of args.items ?? []) {
      const place = places[index - 1]
      if (!place) continue
      const maxLevel = place.type === 'hotel' ? 5 : 4
      if (level >= 1 && level <= maxLevel) priceLevels.set(place.id, level)
      if (place.type === 'food_drink' && ff !== undefined) familyFriendly.set(place.id, ff)
    }
    return { priceLevels, familyFriendly, stopReason: response.candidates?.[0]?.finishReason ?? null }
  } catch (e) {
    return { priceLevels, familyFriendly, error: String(e) }
  }
}

// Backwards-compat shim used by the backfill admin route
export async function inferPriceLevels(places: PlaceInput[]): Promise<{ results: Map<string, number>; error?: string; stopReason?: string | null }> {
  const { priceLevels, error, stopReason } = await inferPlaceAttributes(places)
  return { results: priceLevels, error, stopReason }
}
