import { prisma } from '@/lib/prisma'

// The travelers new people are pointed to: the five with the most posted trips (excluding themselves).
export async function suggestedPeople(userId: string) {
  const posted = { visibility: { not: 'draft' } }
  const candidates = await prisma.user.findMany({
    where: { id: { not: userId }, itineraries: { some: posted } },
    select: { id: true, name: true, image: true, _count: { select: { itineraries: { where: posted } } } },
    // Rough order by all trips (drafts included), then re-sorted below by posted trips only.
    orderBy: { itineraries: { _count: 'desc' } },
    take: 20,
  })
  return candidates.map(person => ({ id: person.id, name: person.name, image: person.image, trips: person._count.itineraries }))
    .sort((a, b) => b.trips - a.trips).slice(0, 5)
}

// A new account starts out following the suggested people, so the feed has trips in it straight away (they can
// unfollow on the welcome page). Quiet: no "followed you" alert, or the most active travelers would get one per sign-up.
export async function followSuggestedPeople(userId: string) {
  const people = await suggestedPeople(userId)
  if (people.length) await prisma.follow.createMany({ data: people.map(person => ({ followerId: userId, followingId: person.id, status: 'accepted' })), skipDuplicates: true })
}
