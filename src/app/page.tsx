import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { tripPhotoGallery } from '@/lib/eventPhotos'
import StoryFeed from '@/components/StoryFeed'
import ItineraryCard from '@/components/ItineraryCard'
import Link from 'next/link'
import { Suspense } from 'react'
import FeedTabs from '@/components/FeedTabs'
import Image from 'next/image'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; feed?: string; posted?: string }>
}) {
  const { search, feed: requestedFeed, posted } = await searchParams
  const searchQuery = search?.trim() || ''
  const feed = ['all', 'friends', 'expert'].includes(requestedFeed ?? '') ? requestedFeed! : 'all'
  return <Suspense key={searchQuery} fallback={<div role="status" className="max-w-5xl mx-auto px-4 py-6">{searchQuery ? `Searching for “${searchQuery}”…` : 'Loading trips…'}</div>}>
    <FeedResults searchQuery={searchQuery} feed={feed} posted={posted} />
  </Suspense>
}

async function FeedResults({ searchQuery, feed, posted }: { searchQuery: string; feed: string; posted?: string }) {
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
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      include: {
        user: { select: { name: true, id: true } },
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { orderBy: { isStock: 'asc' } },
        _count: { select: { bucketedBy: true, comments: true } },
      },
    }),
    userId
      ? prisma.bucketListItem.findMany({ where: { userId }, select: { itineraryId: true } })
      : Promise.resolve([]),
  ])

  const justPosted = posted && userId ? itineraries.find(trip => trip.id === posted && trip.userId === userId) : undefined
  const feedTrips = justPosted ? [justPosted, ...itineraries.filter(trip => trip.id !== justPosted.id)] : itineraries

  const bucketSet = new Set(bucketIds.map((b) => b.itineraryId))

  return (
    <div className="max-w-xl mx-auto px-4 py-3 sm:px-8 sm:py-5">
      <Suspense fallback={null}><StoryFeed userId={userId} following={false} /></Suspense>
      <section className="mb-3 mt-3 flex items-center justify-between gap-2 px-1" aria-label="Trip recommendations">
        <h1 className="shrink-0 font-[family-name:var(--font-playfair)] text-sm font-medium tracking-[0.2em] text-[#2e4147]">FOR YOU</h1>
        <FeedTabs active={feed} search={searchQuery} />
      </section>
      {searchQuery && <div className="mb-5">
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#242e25]">&quot;{searchQuery}&quot;</h1>
        <Link href="/" className="text-sm text-[#485340] hover:underline">Clear search</Link>
      </div>}

      {justPosted && feed === 'all' && <p role="status" className="mb-3 rounded-xl bg-[#e8eee8] px-4 py-3 text-sm text-[#355650]">Your postcard is posted.</p>}
      {feed !== 'all' ? (
        <div className="rounded-xl border border-dashed border-[#c9c4b7] bg-[#faf7f1] px-5 py-10 text-center">
          <p className="font-[family-name:var(--font-playfair)] text-xl text-[#2e4147]">{feed === 'friends' ? 'Friends’ trips are coming soon.' : 'Expert recommendations are coming soon.'}</p>
          <p className="mt-2 text-sm text-[#73786d]">For now, browse every trip in All.</p>
        </div>
      ) : itineraries.length === 0 ? (
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
          {feedTrips.map((it) => (
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
              authorId={it.user.id}
              destinations={it.destinations}
              coverPhoto={it.photos[0]?.url ?? null}
              photos={tripPhotoGallery(it.photos, it.destinations.flatMap(destination => destination.items))}
              currentUserId={userId}
              isOwn={it.user.id === userId}
              isBucketed={bucketSet.has(it.id)}
              saveCount={it._count.bucketedBy}
              commentCount={it._count.comments}
              showBudget={false}
            />
          ))}
        </div>
      )}


      {userId && <Link href="/create" aria-label="Post a trip" title="Post a trip" className="fixed bottom-24 left-1/2 z-40 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#355650] p-2 shadow-lg ring-4 ring-[#faf7f1] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355650]"><Image src="/brand/postcard-icon.svg" alt="" width={38} height={38} className="rounded-md" /></Link>}
    </div>
  )
}
