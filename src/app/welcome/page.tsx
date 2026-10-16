import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { saveTripId } from '@/lib/saveTripReturn'
import PeopleList from '@/components/PeopleList'
import { suggestedPeople } from '@/lib/suggestedPeople'

// Right after signing up: the people they already follow (the five travelers with the most posted trips, followed
// when the account was made), so the feed isn't empty. Tap to unfollow any of them.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ saveTrip?: string }> }) {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fwelcome')
  const tripId = saveTripId((await searchParams).saveTrip ?? null)
  // Next: a few questions about their best vacation (then the feed, or the trip they were saving).
  const next = `/welcome/trip${tripId ? `?saveTrip=${encodeURIComponent(tripId)}` : ''}`

  const [suggested, following] = await Promise.all([
    suggestedPeople(userId),
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
  ])
  const followingIds = new Set(following.map(f => f.followingId))
  const people = suggested.map(({ trips, ...person }) => ({ ...person, following: followingIds.has(person.id), meta: `${trips} ${trips === 1 ? 'trip' : 'trips'} posted` }))

  return <div className="page-wrap">
    <header className="page-header">
      <h1 className="page-title">Welcome to Postcard</h1>
      <p className="page-subtitle">You’re following a few travelers so your feed has trips in it. Unfollow anyone you like, and find more people any time under Friends.</p>
    </header>
    {people.length > 0
      ? <PeopleList people={people} viewerId={userId} />
      : <p className="panel p-5 text-sm text-muted">No one has posted a trip yet. Yours could be the first.</p>}
    <Link href={next} className="btn btn-primary mt-6 w-full">Continue</Link>
  </div>
}
