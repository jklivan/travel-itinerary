import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createFollowNotification } from '@/lib/notifications'
import { deliverNotification } from '@/lib/push'

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
