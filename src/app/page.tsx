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
          ...(userId ? [{ userId, visibility: 'private' }] : []),
        ],
        // Explore feed: hide itineraries from private accounts (except own)
        ...(isExplore ? {
          OR: [
            { user: { isPrivate: false } },
            ...(userId ? [{ userId }] : []),
          ],
        } : {}),
        destinations: { some: { items: { some: {} } } },
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
        photos: { take: 1, orderBy: { isStock: 'asc' } },
        _count: { select: { bucketedBy: true } },
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
              budget={it.budget}
              authorName={it.user.name}
              destinations={it.destinations}
              coverPhoto={it.photos[0]?.url ?? null}
              currentUserId={userId}
              isOwn={it.user.id === userId}
              isBucketed={bucketSet.has(it.id)}
              saveCount={it._count.bucketedBy}
            />
          ))}
        </HorizontalScrollFeed>
      )}

      {/* Expert Recs */}
      {!searchQuery && (
        <div className="mt-10">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Expert Recs</h2>
            <p className="text-sm text-gray-500">Curated picks from travel experts</p>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 [&::-webkit-scrollbar]:hidden">
            {[
              { rotate: '-rotate-2' },
              { rotate: 'rotate-1' },
              { rotate: '-rotate-1' },
              { rotate: 'rotate-2' },
              { rotate: '-rotate-1' },
            ].map((p, i) => (
              <div key={i} className={`flex-none w-36 bg-white shadow-md p-2.5 pb-9 ${p.rotate}`}>
                <div className="w-full aspect-square bg-gray-100" />
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 bg-gray-200 rounded w-4/5" />
                  <div className="h-2 bg-gray-100 rounded w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
