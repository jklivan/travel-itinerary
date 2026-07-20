import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    console.error('[places] GOOGLE_PLACES_API_KEY is not set')
    return Response.json([])
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  const type = req.nextUrl.searchParams.get('type') ?? 'destination'

  if (!q || q.length < 2) return Response.json([])

  const body: Record<string, unknown> = {
    input: q,
    languageCode: 'en',
  }

  // Add type filtering only where safe
  if (type === 'hotel') {
    body.includedPrimaryTypes = ['lodging']
  }
  // restaurant, destination, activity: no type filter — too broad to restrict

  let res: Response
  try {
    res = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': '*',
        },
        body: JSON.stringify(body),
      }
    )
  } catch (err) {
    console.error('[places] fetch error:', err)
    return Response.json([])
  }

  const data = await res.json()

  if (!res.ok) {
    console.error('[places] API error:', JSON.stringify(data))
    return Response.json([])
  }

  type Suggestion = {
    placePrediction?: {
      text?: { text: string }
      structuredFormat?: {
        mainText?: { text: string }
        secondaryText?: { text: string }
      }
    }
  }

  const suggestions = (data.suggestions ?? []).slice(0, 6).map((s: Suggestion) => {
    const p = s.placePrediction ?? {}
    const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? ''
    const secondary = p.structuredFormat?.secondaryText?.text ?? ''
    return { label: p.text?.text ?? main, main, secondary }
  })

  return Response.json(suggestions)
}
