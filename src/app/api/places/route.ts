import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    console.error('[places] GOOGLE_PLACES_API_KEY is not set')
    return Response.json([])
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  const type = req.nextUrl.searchParams.get('type') ?? 'destination'

  if (!q || q.length < 2) return Response.json([])

  type RawSuggestion = {
    placePrediction?: {
      placeId?: string
      text?: { text: string }
      structuredFormat?: {
        mainText?: { text: string }
        secondaryText?: { text: string }
      }
    }
  }

  async function autocomplete(body: Record<string, unknown>) {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': '*',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[places] API error:', JSON.stringify(err))
      return []
    }
    const data = await res.json()
    return (data.suggestions ?? []) as RawSuggestion[]
  }

  function toSuggestion(s: RawSuggestion, isAddress = false) {
    const p = s.placePrediction ?? {}
    const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? ''
    const secondary = p.structuredFormat?.secondaryText?.text ?? ''
    // For address results, fold city into the label so the stored name is unambiguous
    const label = isAddress && secondary ? `${main}, ${secondary}` : (p.text?.text ?? main)
    return { label, main: isAddress && secondary ? label : main, secondary, placeId: p.placeId ?? null }
  }

  let rawResults: RawSuggestion[]

  if (type === 'hotel') {
    // Run both queries in parallel: named lodging + free-text addresses
    const [lodgingRaw, addressRaw] = await Promise.all([
      autocomplete({ input: q, languageCode: 'en', includedPrimaryTypes: ['lodging'] }),
      autocomplete({ input: q, languageCode: 'en' }),
    ])
    // Merge: lodging results first, then address results not already present
    const seen = new Set(lodgingRaw.map(s => s.placePrediction?.placeId).filter(Boolean))
    const merged = [
      ...lodgingRaw.map(s => toSuggestion(s, false)),
      ...addressRaw
        .filter(s => !seen.has(s.placePrediction?.placeId))
        .map(s => toSuggestion(s, true)),
    ]
    return Response.json(merged.slice(0, 7))
  }

  try {
    rawResults = await autocomplete({ input: q, languageCode: 'en' })
  } catch (err) {
    console.error('[places] fetch error:', err)
    return Response.json([])
  }

  const suggestions = rawResults.slice(0, 6).map(s => toSuggestion(s))
  return Response.json(suggestions)
}
