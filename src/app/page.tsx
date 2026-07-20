import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import ItineraryCard from '@/components/ItineraryCard'
import Link from 'next/link'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; search?: string }>
}) {
  const { view, search } = await searchParams
  const session = await auth()
  const searchQuery = search?.trim() || ''

  // Logged-in users see their friends feed by default; ?view=explore shows everything
  const isExplore = !session?.user?.id || view === 'explore'
  const isFriends = !isExplore

  let userIdFilter: { in: string[] } | undefined
  if (isFriends && session?.user?.id) {
    const follows = await prisma.follow.findMany({
      where: { followerId: session.user.id, status: 'accepted' },
    })
    // Include own itineraries + friends'
    const ids = [...follows.map((f) => f.followingId), session.user.id]
    userIdFilter = { in: ids }
  }

  const itineraries = await prisma.itinerary.findMany({
    where: {
      OR: [
        { visibility: 'public' },
        ...(session?.user?.id ? [{ userId: session.user.id }] : []),
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
      user: { select: { name: true } },
      destinations: { orderBy: { order: 'asc' }, include: { items: true } },
      photos: { take: 1 },
    },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {searchQuery
              ? `"${searchQuery}"`
              : isFriends ? 'Friends' : 'Explore'}
          </h1>
          <p className="text-gray-600 text-sm mt-0.5">
            {searchQuery
              ? <Link href="/" className="text-indigo-500 hover:underline">← Clear search</Link>
              : isFriends
              ? 'Itineraries from people you follow'
              : 'Discover trips from around the world'}
          </p>
        </div>

        {session?.user && (
          <div className="flex gap-1 bg-white rounded-xl p-1 text-sm font-medium shadow-sm border border-gray-200">
            <Link href="/"
              className={`px-4 py-1.5 rounded-lg transition-colors ${
                isFriends ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700 hover:text-gray-900'
              }`}>
              Friends
            </Link>
            <Link href="/?view=explore"
              className={`px-4 py-1.5 rounded-lg transition-colors ${
                isExplore ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700 hover:text-gray-900'
              }`}>
              Explore
            </Link>
          </div>
        )}
      </div>

      {itineraries.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">{isFriends ? '👥' : '🌍'}</p>
          <p className="text-lg font-medium text-gray-900">
            {isFriends ? 'No itineraries from friends yet.' : 'No itineraries yet.'}
          </p>
          <p className="text-sm mt-1 text-gray-900">
            {isFriends ? (
              <Link href="/friends" className="text-indigo-600 hover:underline">Follow some travellers</Link>
            ) : 'Be the first to share a trip!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {itineraries.map((it) => (
            <ItineraryCard
              key={it.id}
              id={it.id}
              title={it.title}
              startDate={it.startDate}
              endDate={it.endDate}
              audience={it.audience}
              authorName={it.user.name}
              destinations={it.destinations}
              coverPhoto={it.photos[0]?.url ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
