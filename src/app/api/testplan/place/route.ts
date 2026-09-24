import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { eventPhotos } from '@/lib/eventPhotos'
import { matchesPlace, type PhotoAttribution } from '@/lib/placePhoto'

// Details for a recommendation card's pop-out on /testplan: the friend's own notes and photos when the
// pick came from a trip, otherwise what Google knows about the place.
const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API
type GooglePlace = { id?: string; displayName?: { text?: string }; formattedAddress?: string; websiteUri?: string; editorialSummary?: { text?: string }; rating?: number; userRatingCount?: number; photos?: { name?: string; authorAttributions?: PhotoAttribution[] }[] }
const FIELDS = 'id,displayName,formattedAddress,websiteUri,editorialSummary,rating,userRatingCount,photos'

async function googlePlace(query: { placeId?: string | null; name: string; city: string; country?: string | null }): Promise<GooglePlace | null> {
  if (!API_KEY) return null
  const headers = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY }
  const signal = AbortSignal.timeout(8000)
  try {
    if (query.placeId) {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(query.placeId)}`, { headers: { ...headers, 'X-Goog-FieldMask': FIELDS }, signal })
      return response.ok ? await response.json() : null
    }
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', headers: { ...headers, 'X-Goog-FieldMask': FIELDS.split(',').map(field => `places.${field}`).join(',') }, signal,
      body: JSON.stringify({ textQuery: [query.name, query.city, query.country].filter(Boolean).join(', '), pageSize: 3 }),
    })
    if (!response.ok) return null
    const places = ((await response.json()) as { places?: GooglePlace[] }).places ?? []
    // Prefer an exact name match; Claude's names can differ slightly from Google's, so fall back to the top result.
    return places.find(place => matchesPlace(query.name, query.city, place)) ?? places[0] ?? null
  } catch { return null }
}

async function googlePhotos(place: GooglePlace | null, limit: number) {
  if (!API_KEY || !place?.photos?.length) return []
  const photos = await Promise.all(place.photos.slice(0, limit).map(async photo => {
    if (!photo.name || !/^places\/[^/]+\/photos\/[^/]+$/.test(photo.name)) return null
    try {
      const response = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=900&skipHttpRedirect=true`, { headers: { 'X-Goog-Api-Key': API_KEY }, signal: AbortSignal.timeout(8000) })
      const data = response.ok ? await response.json() as { photoUri?: string } : null
      return data?.photoUri?.startsWith('https://') ? { url: data.photoUri, credit: photo.authorAttributions?.[0]?.displayName ?? null } : null
    } catch { return null }
  }))
  return photos.filter(photo => photo !== null)
}

export async function GET(request: NextRequest) {
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const params = request.nextUrl.searchParams
  const itemId = params.get('item')?.trim()
  const reply = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'private, max-age=600' } })

  if (itemId) {
    // Only your own trips, or published trips of people you follow — the same data the chat was given.
    const item = await prisma.destItem.findFirst({
      where: { id: itemId, destination: { itinerary: { OR: [{ userId }, { visibility: 'public', user: { followers: { some: { followerId: userId, status: 'accepted' } } } }] } } },
      include: { destination: { include: { itinerary: { select: { id: true, title: true, userId: true, visibility: true, user: { select: { name: true } } } } } } },
    })
    if (!item) return Response.json({ error: 'This place is no longer available.' }, { status: 404 })
    const trip = item.destination.itinerary
    const own = eventPhotos(item.photoUrls, item.photoUrl)
    const google = own.length && item.address && item.link ? null : await googlePlace({ placeId: item.placeId, name: item.name, city: item.destination.name, country: item.destination.country })
    return reply({
      author: trip.userId === userId ? null : trip.user.name, notes: item.notes, rating: item.rating,
      description: item.description ?? google?.editorialSummary?.text ?? null,
      photos: own.length ? own.map(url => ({ url, credit: null })) : await googlePhotos(google, 5),
      photosFromGoogle: !own.length,
      address: item.address ?? google?.formattedAddress ?? null, website: item.link ?? google?.websiteUri ?? null,
      placeId: item.placeId ?? google?.id ?? null,
      trip: { title: trip.title, href: trip.visibility === 'draft' ? `/plan/${trip.id}` : `/itinerary/${trip.id}` },
    })
  }

  const name = params.get('name')?.trim() ?? ''
  const city = params.get('city')?.trim() ?? ''
  if (!name || !city || name.length > 240 || city.length > 240) return Response.json({ error: 'Missing place.' }, { status: 400 })
  const google = await googlePlace({ name, city, country: params.get('country')?.trim() })
  return reply({
    author: null, notes: null, rating: null, trip: null,
    description: google?.editorialSummary?.text ?? null,
    googleRating: google?.rating ? { value: google.rating, count: google.userRatingCount ?? 0 } : null,
    photos: await googlePhotos(google, 5), photosFromGoogle: true,
    address: google?.formattedAddress ?? null, website: google?.websiteUri ?? null, placeId: google?.id ?? null,
  })
}
