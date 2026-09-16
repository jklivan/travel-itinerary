import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { tripPhotoGallery } from '@/lib/eventPhotos'
import StoryFeed from '@/components/StoryFeed'
import PlanningShortcut from '@/components/PlanningShortcut'
import ItineraryCard from '@/components/ItineraryCard'
import Link from 'next/link'
import { Suspense } from 'react'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; feed?: string }>
}) {
  const { search, feed } = await searchParams
  const activeFeed = feed === 'following' ? 'following' : 'for-you'
  const searchQuery = search?.trim() || ''
  return <Suspense key={`${activeFeed}:${searchQuery}`} fallback={<div role="status" className="max-w-5xl mx-auto px-4 py-6">{searchQuery ? `Searching for “${searchQuery}”…` : 'Loading trips…'}</div>}>
    <FeedResults searchQuery={searchQuery} activeFeed={activeFeed} />
  </Suspense>
}

async function FeedResults({ searchQuery, activeFeed }: { searchQuery: string; activeFeed: 'for-you' | 'following' }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const friendIds = activeFeed === 'following' && userId
    ? (await prisma.follow.findMany({
      where: { followerId: userId, status: 'accepted' },
      select: { followingId: true },
    })).map((follow) => follow.followingId)
    : []

  const [itineraries, bucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: {
        visibility: { not: 'draft' },
        ...(activeFeed === 'following' ? { userId: { in: friendIds } } : {}),
        destinations: { some: { items: { some: {} } } },
        ...(searchQuery ? {
          destinations: {
            some: {
              items: { some: {} },
              OR: [
                { name: { contains: searchQuery, mode: 'insensitive' } },
                { country: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
          },
        } : {}),
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      include: {
        user: { select: { name: true, id: true } },
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { orderBy: { isStock: 'asc' } },
        _count: { select: { bucketedBy: true } },
      },
    }),
    userId
      ? prisma.bucketListItem.findMany({ where: { userId }, select: { itineraryId: true } })
      : Promise.resolve([]),
  ])

  const bucketSet = new Set(bucketIds.map((b) => b.itineraryId))

  return (
    <div className="max-w-xl mx-auto px-5 py-6 sm:px-8">
      <Suspense fallback={null}><StoryFeed userId={userId} following={activeFeed === 'following'} /></Suspense>
      {userId && <Suspense fallback={null}><PlanningShortcut userId={userId} /></Suspense>}
      <nav aria-label="Feed filters" className="mb-6 flex border-b border-[#C4A882]/50">
        {([{ value: 'for-you', label: 'For You' }, { value: 'following', label: 'Following' }] as const).map(tab => {
          const query = new URLSearchParams()
          if (tab.value === 'following') query.set('feed', 'following')
          if (searchQuery) query.set('search', searchQuery)
          const active = activeFeed === tab.value
          return <Link key={tab.value} href={query.size ? `/?${query}` : '/'} aria-current={active ? 'page' : undefined}
            className={`flex-1 border-b-2 px-4 py-3 text-center text-base font-semibold transition-colors ${active ? 'border-[#2C1810] text-[#2C1810]' : 'border-transparent text-[#8B6F4E] hover:text-[#2C1810]'}`}>
            {tab.label}
          </Link>
        })}
      </nav>
      {searchQuery && <div className="mb-5">
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">&quot;{searchQuery}&quot;</h1>
        <Link href={activeFeed === 'following' ? '/?feed=following' : '/'} className="text-sm text-[#5C3D2E] hover:underline">Clear search</Link>
      </div>}

      {itineraries.length === 0 ? (
        <div className="text-center py-20 bg-[#FAF7F2] rounded-xl border border-[#E8D5B7]">
          <p className="text-4xl mb-4">🌍</p>
          <p className="text-base font-medium text-[#2C1810]">
            {activeFeed === 'following' ? userId ? 'No trips from people you follow yet.' : 'Sign in to see trips from people you follow.' : searchQuery ? 'No trips match your search.' : 'No itineraries yet.'}
          </p>
          <p className="text-sm mt-1 text-[#8B6F4E]">
            {activeFeed === 'following' ? <Link href={userId ? '/friends' : '/login?callbackUrl=%2F%3Ffeed%3Dfollowing'} className="underline">{userId ? 'Find people to follow' : 'Sign in'}</Link> : searchQuery ? 'Try another destination in Explore.' : 'Be the first to share a trip!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:gap-5" aria-label={activeFeed === 'following' ? 'Following trips' : 'For You trips'}>
          {itineraries.map((it) => (
            <ItineraryCard
              key={it.id}
              fullWidth
              id={it.id}
              postType={it.postType}
              title={it.title}
              bestMonths={it.bestMonths}
              datesFlexible={it.datesFlexible}
              startDate={it.startDate}
              endDate={it.endDate}
              audience={it.audience}
              budget={it.budget}
              tripRating={it.tripRating}
              authorName={it.user.name}
              destinations={it.destinations}
              coverPhoto={it.photos[0]?.url ?? null}
              photos={tripPhotoGallery(it.photos, it.destinations.flatMap(destination => destination.items))}
              currentUserId={userId}
              isOwn={it.user.id === userId}
              isBucketed={bucketSet.has(it.id)}
              saveCount={it._count.bucketedBy}
            />
          ))}
        </div>
      )}


    </div>
  )
}
