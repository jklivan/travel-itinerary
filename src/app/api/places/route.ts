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

  // Only use types confirmed valid in the Places API (New)
  let includedPrimaryTypes: string[] | undefined
  if (type === 'hotel') {
    includedPrimaryTypes = ['lodging']
  } else if (type === 'restaurant') {
    includedPrimaryTypes = ['restaurant', 'cafe', 'bar']
  } else if (type === 'activity') {
    includedPrimaryTypes = ['tourist_attraction', 'museum', 'park', 'zoo', 'art_gallery', 'aquarium', 'amusement_park']
  } else {
    // destination — locality + countries
    includedPrimaryTypes = ['locality', 'administrative_area_level_1']
  }

  const body: Record<string, unknown> = {
    input: q,
    languageCode: 'en',
  }
  if (includedPrimaryTypes) {
    body.includedPrimaryTypes = includedPrimaryTypes
  }

  let res: Response
  try {
    res = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
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

  const suggestions = (data.suggestions ?? []).slice(0, 6).map((s: {
    placePrediction: {
      text: { text: string }
      structuredFormat?: {
        mainText: { text: string }
        secondaryText?: { text: string }
      }
    }
  }) => {
    const p = s.placePrediction
    const main = p.structuredFormat?.mainText?.text ?? p.text.text
    const secondary = p.structuredFormat?.secondaryText?.text ?? ''
    return { label: p.text.text, main, secondary }
  })

  return Response.json(suggestions)
}
