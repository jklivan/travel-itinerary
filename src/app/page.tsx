import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { tripPhotoGallery } from '@/lib/eventPhotos'
import StoryFeed from '@/components/StoryFeed'
import ItineraryCard from '@/components/ItineraryCard'
import Link from 'next/link'
import { Suspense } from 'react'
import FeedTabs from '@/components/FeedTabs'
import WelcomeScreen from '@/components/WelcomeScreen'

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
  // Signed out: the welcome screen instead of the feed.
  if (!userId) return <WelcomeScreen />

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
        user: { select: { name: true, id: true, image: true } },
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { orderBy: { isStock: 'asc' } },
        likes: { where: { userId: userId ?? '' }, select: { id: true }, take: 1 }, _count: { select: { likes: true, bucketedBy: true, comments: true } },
      },
    }),
    userId
      ? prisma.bucketListItem.findMany({ where: { userId }, select: { itineraryId: true } })
      : Promise.resolve([]),
  ])

  const justPosted = posted && userId ? itineraries.find(trip => trip.id === posted && trip.userId === userId) : undefined
  const feedTrips = justPosted ? [justPosted, ...itineraries.filter(trip => trip.id !== justPosted.id)] : itineraries

  const bucketSet = new Set(bucketIds.map((b) => b.itineraryId))

  // Instagram-style lines under each card: who liked it (friends first) and one comment preview
  // (a friend's, else the most-replied, else the newest).
  const tripIds = feedTrips.map(trip => trip.id)
  const friendIds = userId ? (await prisma.follow.findMany({ where: { followerId: userId, status: 'accepted' }, select: { followingId: true } })).map(row => row.followingId) : []
  const [friendLikes, topComments] = tripIds.length ? await Promise.all([
    friendIds.length ? prisma.tripLike.findMany({ where: { itineraryId: { in: tripIds }, userId: { in: friendIds } }, orderBy: { createdAt: 'desc' }, select: { itineraryId: true, user: { select: { id: true, name: true } } } }) : Promise.resolve([]),
    prisma.comment.findMany({ where: { itineraryId: { in: tripIds }, parentId: null }, orderBy: { createdAt: 'desc' }, select: { itineraryId: true, content: true, userId: true, user: { select: { name: true } }, _count: { select: { replies: true } } } }),
  ]) : [[], []]
  const social = new Map(tripIds.map(id => {
    const liker = friendLikes.find(like => like.itineraryId === id)?.user ?? null
    const comments = topComments.filter(comment => comment.itineraryId === id)
    const pick = comments.find(comment => friendIds.includes(comment.userId))
      ?? [...comments].sort((a, b) => b._count.replies - a._count.replies)[0]
    return [id, { likedBy: liker, comment: pick ? { userId: pick.userId, name: pick.user.name, text: pick.content.split('\n')[0].slice(0, 200) } : null }]
  }))

  return (
    <div className="max-w-xl mx-auto px-4 py-3 sm:px-8 sm:py-5">
      <Suspense fallback={null}><StoryFeed userId={userId} following={false} /></Suspense>
      <section className="mb-3 mt-3 flex items-center justify-between gap-2 px-1" aria-label="Trip recommendations">
        <h1 className="type-title shrink-0 tracking-widest">FOR YOU</h1>
        <FeedTabs active={feed} search={searchQuery} />
      </section>
      {searchQuery && <div className="mb-5">
        <h1 className="type-display">&quot;{searchQuery}&quot;</h1>
        <Link href="/" className="text-sm text-ink-soft hover:underline">Clear search</Link>
      </div>}

      {justPosted && feed === 'all' && <p role="status" className="mb-3 rounded-xl bg-mist px-4 py-3 text-sm text-ink">Your postcard is posted.</p>}
      {feed !== 'all' ? (
        <div className="panel-dashed px-5 py-10 text-center">
          <p className="font-[family-name:var(--font-playfair)] text-title text-ink">{feed === 'friends' ? 'Friends’ trips are coming soon.' : 'Expert recommendations are coming soon.'}</p>
          <p className="mt-2 text-sm text-muted">For now, browse every trip in All.</p>
        </div>
      ) : itineraries.length === 0 ? (
        <div className="panel text-center py-20">
          <p className="text-display-lg mb-4">🌍</p>
          <p className="text-base font-medium text-ink">
            {searchQuery ? 'No trips match your search.' : 'No itineraries yet.'}
          </p>
          <p className="text-sm mt-1 text-brown">
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
              authorImage={it.user.image}
              authorId={it.user.id}
              destinations={it.destinations}
              coverPhoto={it.coverPhoto ?? it.photos[0]?.url ?? null}
              photos={tripPhotoGallery(it.photos, it.destinations.flatMap(destination => destination.items), it.coverPhoto)}
              currentUserId={userId}
              isOwn={it.user.id === userId}
              isBucketed={bucketSet.has(it.id)}
              likeCount={it._count.likes} isLiked={it.likes.length > 0}
              commentCount={it._count.comments}
              social={social.get(it.id)}
            />
          ))}
        </div>
      )}


    </div>
  )
}
