import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import ItineraryCard from '@/components/ItineraryCard'
import HorizontalScrollFeed from '@/components/HorizontalScrollFeed'
import Link from 'next/link'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; search?: string }>
}) {
  const { view, search } = await searchParams
  const session = await auth()
  const searchQuery = search?.trim() || ''
  const userId = session?.user?.id ?? null

  const isExplore = !userId || view === 'explore'
  const isFriends = !isExplore

  let userIdFilter: { in: string[] } | undefined
  if (isFriends && userId) {
    const follows = await prisma.follow.findMany({
      where: { followerId: userId, status: 'accepted' },
    })
    const ids = [...follows.map((f) => f.followingId), userId]
    userIdFilter = { in: ids }
  }

  const [itineraries, bucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: {
        OR: [
          { visibility: 'public' },
          ...(userId ? [{ userId }] : []),
        ],
        ...(isFriends && userIdFilter ? { userId: userIdFilter } : {}),
        ...(searchQuery ? {
          destinations: {
            some: {
              OR: [
                { name: { contains: searchQuery, mode: 'insensitive' } },
                { country: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
          },
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, id: true } },
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { take: 1 },
      },
    }),
    userId
      ? prisma.bucketListItem.findMany({ where: { userId }, select: { itineraryId: true } })
      : Promise.resolve([]),
  ])

  const bucketSet = new Set(bucketIds.map((b) => b.itineraryId))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {searchQuery ? (
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">&quot;{searchQuery}&quot;</h2>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Clear search</Link>
        </div>
      ) : (
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {isFriends ? 'Friends\' Trips' : 'Explore'}
          </h2>
          <p className="text-sm text-gray-500">
            {isFriends ? 'Itineraries from people you follow' : 'Discover trips from around the world'}
          </p>
        </div>
      )}

      {itineraries.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm">
          <p className="text-4xl mb-4">{isFriends ? '👥' : '🌍'}</p>
          <p className="text-base font-medium text-gray-900">
            {isFriends ? 'No itineraries from friends yet.' : 'No itineraries yet.'}
          </p>
          <p className="text-sm mt-1 text-gray-500">
            {isFriends ? (
              <Link href="/friends" className="text-blue-600 hover:underline">Follow some travellers</Link>
            ) : 'Be the first to share a trip!'}
          </p>
        </div>
      ) : (
        <HorizontalScrollFeed>
          {itineraries.map((it) => (
            <ItineraryCard
              key={it.id}
              id={it.id}
              postType={it.postType}
              title={it.title}
              startDate={it.startDate}
              endDate={it.endDate}
              audience={it.audience}
              authorName={it.user.name}
              destinations={it.destinations}
              coverPhoto={it.photos[0]?.url ?? null}
              currentUserId={userId}
              isOwn={it.user.id === userId}
              isBucketed={bucketSet.has(it.id)}
            />
          ))}
        </HorizontalScrollFeed>
      )}
    </div>
  )
}
