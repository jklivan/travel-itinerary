import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { saveTripId } from '@/lib/saveTripReturn'

// After signing in with Google or Apple: an account made just now goes through the intro (like an email sign-up),
// anyone else goes on to the trip they were saving or the Feed.
export default async function ContinueAfterSignIn({ searchParams }: { searchParams: Promise<{ saveTrip?: string }> }) {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login')
  const tripId = saveTripId((await searchParams).saveTrip ?? null)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
  const isNew = !!user && Date.now() - user.createdAt.getTime() < 10 * 60 * 1000
  if (isNew) redirect(tripId ? `/welcome/intro?saveTrip=${encodeURIComponent(tripId)}` : '/welcome/intro')
  redirect(tripId ? `/itinerary/${tripId}` : '/')
}
