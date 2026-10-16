'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { TAGS } from '@/lib/tags'
import { TRAVELERS } from '@/lib/travelPreferences'
import { locateDestinations } from '@/lib/locateDestinations'
import { locateTripPlaces } from '@/lib/locatePlaces'

// Who it was with → who the trip is for.
const AUDIENCE: Record<string, string> = { Solo: 'adult', Couple: 'romantic', 'Family with kids': 'family', Friends: 'friends' }

export type BestVacation = { destination: string; travelers: string; hotel: { name: string; placeId: string | null } | null; tags: string[] }

// Sign-up's "your best vacation" questions, saved as a private trip in My Trips: where, with whom, where they stayed
// (as its place to stay) and what they did (as its tags). The trip planner learns their taste from it.
export async function saveBestVacation(input: BestVacation): Promise<{ id?: string; error?: string }> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  const destination = typeof input?.destination === 'string' ? input.destination.trim().slice(0, 160) : ''
  if (!destination) return { error: 'Tell us where it was.' }
  const travelers = TRAVELERS.includes(input.travelers as typeof TRAVELERS[number]) ? input.travelers : ''
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.filter(tag => TAGS.some(known => known.id === tag && known.id !== 'day-trip')))] : []
  const hotelName = typeof input.hotel?.name === 'string' ? input.hotel.name.trim().slice(0, 240) : ''
  const placeId = typeof input.hotel?.placeId === 'string' && /^[\w-]{10,300}$/.test(input.hotel.placeId) ? input.hotel.placeId : null
  try {
    const trip = await prisma.itinerary.create({ data: {
      userId, title: `Best vacation: ${destination.split(',')[0]}`, audience: AUDIENCE[travelers] ?? 'family', visibility: 'draft', postType: 'guide', tags,
      datesFlexible: true, startDate: new Date('2000-01-01T00:00:00Z'), endDate: new Date('2000-01-01T00:00:00Z'),
      destinations: { create: [{ name: destination, order: 0, ...(hotelName ? { items: { create: [{ name: hotelName, type: 'hotel', placeId, order: 0 }] } } : {}) }] },
    }, select: { id: true } })
    after(async () => { await locateDestinations(trip.id).catch(() => {}); await locateTripPlaces(trip.id).catch(() => {}) })
    revalidatePath('/trips')
    return { id: trip.id }
  } catch { return { error: 'Could not save. Please try again.' } }
}
