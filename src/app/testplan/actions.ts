'use server'

import { auth } from '@/auth'
import { findPlannerTrip, plannerTripProps } from './plannerTrip'

// The "Your trip" box's contents after places are added from the chat, so it updates in place (no page reload,
// which would jump the chat back to the top and lose the other suggestions' state).
export async function plannerTrip(tripId: string) {
  const userId = (await auth())?.user?.id
  if (!userId || typeof tripId !== 'string' || tripId.length > 100) return null
  const trip = await findPlannerTrip(userId, tripId)
  return trip ? plannerTripProps(trip) : null
}
