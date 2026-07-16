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
  const isFriends = view === 'friends' && !!session?.user?.id
  const searchQuery = search?.trim() || ''

  let userIdFilter: { in: string[] } | undefined
  if (isFriends && session?.user?.id) {
    const follows = await prisma.follow.findMany({ where: { followerId: session.user.id } })
    const ids = follows.map((f) => f.followingId)
    userIdFilter = { in: ids }
  }

  const itineraries = await prisma.itinerary.findMany({
    where: {
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
      destinations: { orderBy: { order: 'asc' } },
      photos: { take: 1 },
    },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {searchQuery ? `"${searchQuery}"` : 'Itineraries'}
          </h1>
          <p className="text-gray-700 mt-1">
            {searchQuery
              ? <Link href="/" className="text-indigo-500 hover:underline text-sm">← Clear search</Link>
              : 'Discover trips planned by travellers around the world.'}
          </p>
        </div>

        {session?.user && (
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium">
            <Link href="/"
              className={`px-4 py-1.5 rounded-lg transition-colors ${
                !isFriends ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}>
              Explore
            </Link>
            <Link href="/?view=friends"
              className={`px-4 py-1.5 rounded-lg transition-colors ${
                isFriends ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}>
              Friends
            </Link>
          </div>
        )}
      </div>

      {itineraries.length === 0 ? (
        <div className="text-center py-24 text-gray-600">
          <p className="text-5xl mb-4">{isFriends ? '👥' : '🌍'}</p>
          <p className="text-lg font-medium text-gray-700">
            {isFriends ? 'No itineraries from friends yet.' : 'No itineraries yet.'}
          </p>
          <p className="text-sm mt-1">
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
              description={it.description}
              startDate={it.startDate}
              endDate={it.endDate}
              audience={it.audience}
              authorName={it.user.name}
              destinations={it.destinations}
              coverPhoto={it.photos[0]?.url ?? null}
              createdAt={it.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
