import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { saveTripId } from '@/lib/saveTripReturn'
import SuggestedPeople from '@/components/SuggestedPeople'

// Right after signing up: a few people to follow so the feed isn't empty. For now, the five travelers with the most posted trips.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ saveTrip?: string }> }) {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fwelcome')
  const tripId = saveTripId((await searchParams).saveTrip ?? null)
  const next = tripId ? `/itinerary/${tripId}` : '/'

  const posted = { visibility: { not: 'draft' } }
  const [candidates, following] = await Promise.all([
    prisma.user.findMany({
      where: { id: { not: userId }, itineraries: { some: posted } },
      select: { id: true, name: true, image: true, _count: { select: { itineraries: { where: posted } } } },
      // Rough order by all trips (drafts included), then re-sorted below by posted trips only.
      orderBy: { itineraries: { _count: 'desc' } },
      take: 20,
    }),
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
  ])
  const followingIds = new Set(following.map(f => f.followingId))
  const people = candidates
    .map(person => ({ id: person.id, name: person.name, image: person.image, trips: person._count.itineraries, following: followingIds.has(person.id) }))
    .sort((a, b) => b.trips - a.trips)
    .slice(0, 5)

  return <div className="page-wrap">
    <header className="page-header">
      <h1 className="page-title">Welcome to Postcard</h1>
      <p className="page-subtitle">Follow a few travelers to fill your feed with their trips. You can find more people any time under Friends.</p>
    </header>
    {people.length > 0
      ? <SuggestedPeople people={people} />
      : <p className="panel p-5 text-sm text-muted">No one has posted a trip yet. Yours could be the first.</p>}
    <Link href={next} className="btn btn-primary mt-6 w-full">Continue</Link>
  </div>
}
