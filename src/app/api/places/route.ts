import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const type = req.nextUrl.searchParams.get('type') ?? 'destination'

  if (!q || q.length < 2) return Response.json([])

  // Choose included types based on what we're searching
  const includedTypes =
    type === 'hotel'
      ? ['lodging']
      : type === 'restaurant'
      ? ['restaurant', 'cafe', 'bar', 'food', 'night_club']
      : type === 'activity'
      ? ['tourist_attraction', 'museum', 'park', 'amusement_park', 'zoo', 'art_gallery', 'aquarium']
      : ['locality', 'administrative_area_level_1', 'country', 'tourist_attraction']

  const body = {
    input: q,
    includedPrimaryTypes: includedTypes,
    languageCode: 'en',
  }

  const res = await fetch(
    'https://places.googleapis.com/v1/places:autocomplete',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) return Response.json([])

  const data = await res.json()
  const suggestions = (data.suggestions ?? []).slice(0, 6).map((s: {
    placePrediction: {
      text: { text: string }
      structuredFormat?: {
        mainText: { text: string }
        secondaryText?: { text: string }
      }
      types?: string[]
    }
  }) => {
    const p = s.placePrediction
    const main = p.structuredFormat?.mainText?.text ?? p.text.text
    const secondary = p.structuredFormat?.secondaryText?.text ?? ''
    return { label: p.text.text, main, secondary }
  })

  return Response.json(suggestions)
}
