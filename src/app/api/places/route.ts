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

  // Use legacy Places Autocomplete API (more widely enabled)
  const placeType =
    type === 'hotel' || type === 'restaurant' || type === 'activity'
      ? 'establishment'
      : '(cities)'

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', q)
  url.searchParams.set('key', API_KEY)
  url.searchParams.set('types', placeType)
  url.searchParams.set('language', 'en')

  let res: Response
  try {
    res = await fetch(url.toString())
  } catch (err) {
    console.error('[places] fetch error:', err)
    return Response.json([])
  }

  const data = await res.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('[places] API error:', data.status, data.error_message)
    return Response.json([])
  }

  type Prediction = {
    description: string
    structured_formatting: {
      main_text: string
      secondary_text?: string
    }
  }

  const suggestions = (data.predictions ?? []).slice(0, 6).map((p: Prediction) => ({
    label: p.description,
    main: p.structured_formatting.main_text,
    secondary: p.structured_formatting.secondary_text ?? '',
  }))

  return Response.json(suggestions)
}
