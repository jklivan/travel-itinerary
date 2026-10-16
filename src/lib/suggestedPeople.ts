import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hiddenUserIds } from '@/lib/blocks'
import { createFollowNotification } from '@/lib/notifications'
import { deliverNotification } from '@/lib/push'

// The travelers new people are pointed to: the five with the most posted trips (excluding themselves).
export async function suggestedPeople(userId: string, limit = 5) {
  const posted = { visibility: { not: 'draft' } }
  const candidates = await prisma.user.findMany({
    where: { id: { not: userId }, itineraries: { some: posted } },
    select: { id: true, name: true, image: true, _count: { select: { itineraries: { where: posted } } } },
    // Rough order by all trips (drafts included), then re-sorted below by posted trips only.
    orderBy: { itineraries: { _count: 'desc' } },
    take: 20,
  })
  return candidates.map(person => ({ id: person.id, name: person.name, image: person.image, trips: person._count.itineraries }))
    .sort((a, b) => b.trips - a.trips).slice(0, limit)
}

// A new account starts out following the suggested people, so the feed has trips in it straight away (they can
// unfollow on the welcome page). Each gets the usual "followed you" alert, as with a tapped Follow.
export async function followSuggestedPeople(userId: string) {
  for (const person of await suggestedPeople(userId)) {
    const notificationId = await prisma.$transaction(async tx => {
      await tx.follow.upsert({
        where: { followerId_followingId: { followerId: userId, followingId: person.id } },
        update: { status: 'accepted' },
        create: { followerId: userId, followingId: person.id, status: 'accepted' },
      })
      return createFollowNotification(tx, userId, person.id)
    })
    if (notificationId) after(async () => { try { await deliverNotification(notificationId) } catch { console.error('Follow push delivery failed') } })
  }
}

// Friends > Suggested for you: friends of friends first (people the people you follow follow, most shared first),
// then the most active travelers. Never yourself, anyone you follow, or anyone blocked either way.
export async function peopleToFollow(userId: string, limit = 8) {
  const [follows, hidden] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true, status: true } }),
    hiddenUserIds(userId),
  ])
  const friendIds = follows.filter(follow => follow.status === 'accepted').map(follow => follow.followingId)
  const skip = new Set([userId, ...follows.map(follow => follow.followingId), ...hidden])
  const shared = friendIds.length ? await prisma.follow.groupBy({
    by: ['followingId'], where: { followerId: { in: friendIds }, status: 'accepted', followingId: { notIn: [...skip] } },
    _count: { followingId: true }, orderBy: { _count: { followingId: 'desc' } }, take: limit,
  }) : []
  const viaFriends = await Promise.all(shared.map(async row => {
    const [person, friend] = await Promise.all([
      prisma.user.findUnique({ where: { id: row.followingId }, select: { id: true, name: true, image: true } }),
      prisma.follow.findFirst({ where: { followingId: row.followingId, followerId: { in: friendIds }, status: 'accepted' }, orderBy: { createdAt: 'asc' }, select: { follower: { select: { name: true } } } }),
    ])
    const others = row._count.followingId - 1
    return person && { ...person, meta: `Followed by ${friend?.follower.name.split(' ')[0] ?? 'a friend'}${others > 0 ? ` and ${others} ${others === 1 ? 'other' : 'others'}` : ''}` }
  }))
  const people = viaFriends.filter((person): person is NonNullable<typeof person> => !!person)
  const popular = (await suggestedPeople(userId, 20)).filter(person => !skip.has(person.id) && !people.some(other => other.id === person.id))
  return [...people, ...popular.map(({ trips, ...person }) => ({ ...person, meta: `${trips} ${trips === 1 ? 'trip' : 'trips'} posted` }))].slice(0, limit)
}
