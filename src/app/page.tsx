import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { tripPhotoGallery } from '@/lib/eventPhotos'
import StoryFeed from '@/components/StoryFeed'
import ItineraryCard from '@/components/ItineraryCard'
import Link from 'next/link'
import { Suspense } from 'react'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; feed?: string }>
}) {
  const { search } = await searchParams
  const searchQuery = search?.trim() || ''
  return <Suspense key={searchQuery} fallback={<div role="status" className="max-w-5xl mx-auto px-4 py-6">{searchQuery ? `Searching for “${searchQuery}”…` : 'Loading trips…'}</div>}>
    <FeedResults searchQuery={searchQuery} />
  </Suspense>
}

async function FeedResults({ searchQuery }: { searchQuery: string }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const [itineraries, bucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: {
        visibility: { not: 'draft' },
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
      <Suspense fallback={null}><StoryFeed userId={userId} following={false} /></Suspense>
      <h1 className="mb-6 border-b border-[#c1ad93]/50 px-4 py-3 text-center text-base font-semibold text-[#242e25]">For You</h1>
      {searchQuery && <div className="mb-5">
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#242e25]">&quot;{searchQuery}&quot;</h1>
        <Link href="/" className="text-sm text-[#485340] hover:underline">Clear search</Link>
      </div>}

      {itineraries.length === 0 ? (
        <div className="text-center py-20 bg-[#faf7f1] rounded-xl border border-[#dfd3c2]">
          <p className="text-4xl mb-4">🌍</p>
          <p className="text-base font-medium text-[#242e25]">
            {searchQuery ? 'No trips match your search.' : 'No itineraries yet.'}
          </p>
          <p className="text-sm mt-1 text-[#8B6F4E]">
            {searchQuery ? 'Try another destination in Explore.' : 'Be the first to share a trip!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:gap-5" aria-label="For You trips">
          {itineraries.map((it) => (
            <ItineraryCard
              key={it.id}
              fullWidth
              id={it.id}
              postType={it.postType}
              tags={it.tags}
              durationDays={it.durationDays}
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
