import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { saveTripId } from '@/lib/saveTripReturn'
import IntroSlides from './IntroSlides'

// Right after signing up, before anything else: a short click-through of what Postcard does. Then on to the
// people they follow (/welcome) and the questions about their best vacation.
export default async function IntroPage({ searchParams }: { searchParams: Promise<{ saveTrip?: string }> }) {
  if (!(await auth())?.user?.id) redirect('/login?callbackUrl=%2Fwelcome%2Fintro')
  const tripId = saveTripId((await searchParams).saveTrip ?? null)
  return <IntroSlides next={`/welcome${tripId ? `?saveTrip=${encodeURIComponent(tripId)}` : ''}`} />
}
