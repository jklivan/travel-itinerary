import { prisma } from '@/lib/prisma'

// Saves coordinates for places that have a Google place ID but none yet (planner and AI picks often don't),
// so they show on trip maps. Looked up by ID, never by name. A trip page runs this in the background.
export async function fillPlaceCoordinates(items: { id: string; placeId: string }[]) {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API
  if (!key) return
  const batch = items.slice(0, 40)
  for (let index = 0; index < batch.length; index += 5) {
    await Promise.allSettled(batch.slice(index, index + 5).map(async item => {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(item.placeId)}`, {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location' }, cache: 'no-store', signal: AbortSignal.timeout(6000),
      })
      if (!response.ok) return
      const { location } = await response.json() as { location?: { latitude?: number; longitude?: number } }
      if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) return
      // Only if it still has this place and no coordinates (an edit in between wins).
      await prisma.destItem.updateMany({ where: { id: item.id, placeId: item.placeId, lat: null }, data: { lat: location!.latitude!, lng: location!.longitude! } })
    }))
  }
}
