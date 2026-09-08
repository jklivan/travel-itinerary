import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import ItineraryCard from '@/components/ItineraryCard'
import HorizontalScrollFeed from '@/components/HorizontalScrollFeed'
import Link from 'next/link'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search } = await searchParams
  const session = await auth()
  const searchQuery = search?.trim() || ''
  const userId = session?.user?.id ?? null

  const friendIds = userId
    ? (await prisma.follow.findMany({
      where: { followerId: userId, status: 'accepted' },
      select: { followingId: true },
    })).map((follow) => follow.followingId)
    : []

  const [itineraries, bucketIds, friendItineraries] = await Promise.all([
    prisma.itinerary.findMany({
      where: {
        visibility: { not: 'draft' },
        destinations: { some: { items: { some: {} } } },
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
      orderBy: [
        { bucketedBy: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
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
    friendIds.length > 0
      ? prisma.itinerary.findMany({
          where: {
            userId: { in: friendIds },
            visibility: { not: 'draft' },
            destinations: { some: { items: { some: {} } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: { select: { name: true, id: true } },
            destinations: { orderBy: { order: 'asc' }, include: { items: true } },
            photos: { take: 1, orderBy: { isStock: 'asc' } },
            _count: { select: { bucketedBy: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const bucketSet = new Set(bucketIds.map((b) => b.itineraryId))

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {searchQuery ? (
        <div className="mb-5">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">&quot;{searchQuery}&quot;</h2>
          <Link href="/" className="text-sm text-[#5C3D2E] hover:underline">← Clear search</Link>
        </div>
      ) : (
        <div className="mb-5">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">
            Discover trips
          </h2>
        </div>
      )}

      {itineraries.length === 0 ? (
        <div className="text-center py-20 bg-[#FAF7F2] rounded-xl border border-[#E8D5B7]">
          <p className="text-4xl mb-4">🌍</p>
          <p className="text-base font-medium text-[#2C1810]">
            No itineraries yet.
          </p>
          <p className="text-sm mt-1 text-[#8B6F4E]">
            Be the first to share a trip!
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

      {!searchQuery && userId && (
        <div className="mt-10">
          <div className="mb-4">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">Friends&apos; Trips</h2>
            <p className="text-sm text-[#8B6F4E]">Recent itineraries from people you follow</p>
          </div>
          {friendItineraries.length > 0 ? (
            <HorizontalScrollFeed>
              {friendItineraries.map((it) => (
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
                  isOwn={false}
                  isBucketed={bucketSet.has(it.id)}
                  saveCount={it._count.bucketedBy}
                />
              ))}
            </HorizontalScrollFeed>
          ) : (
            <p className="text-sm text-[#8B6F4E]">Follow friends to see their trips here.</p>
          )}
        </div>
      )}
    </div>
  )
}
