'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { TAGS } from '@/lib/tags'
import { TRAVELERS } from '@/lib/travelPreferences'

export type BestVacation = { destination: string; travelers: string; hotel: { name: string; placeId: string | null } | null; tags: string[] }

// Sign-up's "your best vacation" questions: where, with whom, where they stayed and what they did. Kept on the account
// (not shown anywhere); the trip planner leans on it until they've added trips of their own, then weighs it like one.
export async function saveBestVacation(input: BestVacation): Promise<{ ok?: boolean; error?: string }> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  const destination = typeof input?.destination === 'string' ? input.destination.trim().slice(0, 160) : ''
  if (!destination) return { error: 'Tell us where it was.' }
  const travelers = TRAVELERS.includes(input.travelers as typeof TRAVELERS[number]) ? input.travelers : ''
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.filter(tag => TAGS.some(known => known.id === tag && known.id !== 'day-trip')))] : []
  const hotelName = typeof input.hotel?.name === 'string' ? input.hotel.name.trim().slice(0, 240) : ''
  const placeId = typeof input.hotel?.placeId === 'string' && /^[\w-]{10,300}$/.test(input.hotel.placeId) ? input.hotel.placeId : null
  try {
    const bestVacation = { destination, travelers, hotel: hotelName ? { name: hotelName, placeId } : null, tags, savedAt: new Date().toISOString() }
    await prisma.user.update({ where: { id: userId }, data: { bestVacation } })
    return { ok: true }
  } catch { return { error: 'Could not save. Please try again.' } }
}
