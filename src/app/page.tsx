import { prisma } from '@/lib/prisma'
import ItineraryCard from '@/components/ItineraryCard'

export default async function FeedPage() {
  const itineraries = await prisma.itinerary.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true } },
      destinations: { orderBy: { order: 'asc' } },
      photos: { take: 1 },
    },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Explore Itineraries</h1>
        <p className="text-gray-500 mt-1">Discover trips planned by travellers around the world.</p>
      </div>

      {itineraries.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-5xl mb-4">🌍</p>
          <p className="text-lg font-medium text-gray-500">No itineraries yet.</p>
          <p className="text-sm mt-1">Be the first to share a trip!</p>
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
              budget={it.budget}
              currency={it.currency}
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
