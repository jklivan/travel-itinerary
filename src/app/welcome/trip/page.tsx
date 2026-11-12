import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { saveTripId } from '@/lib/saveTripReturn'
import BestVacation from './BestVacation'

export const metadata = { title: 'How you like to travel — Postcard' }

// Sign-up, after following people: a few questions about how they like to travel, then on to the feed (or the trip
// they were saving).
export default async function BestVacationPage({ searchParams }: { searchParams: Promise<{ saveTrip?: string }> }) {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fwelcome%2Ftrip')
  const tripId = saveTripId((await searchParams).saveTrip ?? null)
  return <BestVacation next={tripId ? `/itinerary/${tripId}` : '/'} />
}
