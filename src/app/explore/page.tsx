import { prisma } from '@/lib/prisma'
import type { ItineraryWhereInput } from '@/generated/prisma/models/Itinerary'
import { auth } from '@/auth'
import Link from 'next/link'
import ItineraryCard from '@/components/ItineraryCard'
import HorizontalScrollFeed from '@/components/HorizontalScrollFeed'
import ExploreSearchBar from '@/components/ExploreSearchBar'
import { parseSearchQuery, type ParsedQuery } from '@/lib/parseSearchQuery'
import { tagMeta } from '@/lib/tags'
import { MapPin, Globe, ChevronRight } from 'lucide-react'

const TRIP_TYPE_META: Record<string, { label: string; emoji: string; desc: string }> = {
  family: { label: 'Family', emoji: '👨‍👩‍👧', desc: 'Great for all ages' },
  adult:  { label: 'Adults', emoji: '🍷',   desc: 'Curated for adults' },
  guide:  { label: 'Guides',          emoji: '📖',      desc: 'Expert recommendations' },
}

async function fetchItineraries(
  where: ItineraryWhereInput,
  userId: string | null
) {
  const [itineraries, bucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: { visibility: 'public', ...where },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, id: true } },
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { take: 1, orderBy: { isStock: 'asc' } },
      },
    }),
    userId
      ? prisma.bucketListItem.findMany({ where: { userId }, select: { itineraryId: true } })
      : Promise.resolve([]),
  ])
  return {
    itineraries,
    bucketSet: new Set(bucketIds.map((b) => b.itineraryId)),
  }
}

function ItineraryList({
  itineraries,
  bucketSet,
  userId,
}: {
  itineraries: Awaited<ReturnType<typeof fetchItineraries>>['itineraries']
  bucketSet: Set<string>
  userId: string | null
}) {
  if (itineraries.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl shadow-sm">
        <p className="text-4xl mb-4">🌍</p>
        <p className="text-base font-medium text-gray-900">No trips here yet.</p>
      </div>
    )
  }
  return (
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
        />
      ))}
    </HorizontalScrollFeed>
  )
}

function SearchFiltersDisplay({ parsed }: { parsed: ParsedQuery }) {
  const chips: string[] = []
  if (parsed.audience === 'family') chips.push('👨‍👩‍👧 Family')
  if (parsed.audience === 'adult') chips.push('🍷 Adults')
  if (parsed.postType === 'guide') chips.push('📖 Guides')
  if (parsed.maxBudget) chips.push('$'.repeat(parsed.maxBudget) + ' or less')
  for (const tag of parsed.tags) {
    const m = tagMeta(tag)
    if (m) chips.push(`${m.emoji} ${m.label}`)
  }
  if (parsed.locationTerms.length > 0) chips.push(`📍 ${parsed.locationTerms.slice(0, 3).join(', ')}${parsed.locationTerms.length > 3 ? '…' : ''}`)
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((c) => (
        <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">{c}</span>
      ))}
    </div>
  )
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; city?: string; type?: string; q?: string }>
}) {
  const { country, city, type, q } = await searchParams
  const session = await auth()
  const userId = session?.user?.id ?? null

  // ── Natural language search ────────────────────────────────────────────────
  if (q) {
    const parsed = await parseSearchQuery(q)

    const where: ItineraryWhereInput = {}

    // postType is always a hard filter (guides vs itineraries is unambiguous)
    if (parsed.postType) where.postType = parsed.postType

    if (parsed.locationTerms.length > 0) {
      // Location is the primary intent — use it as the hard filter.
      // Audience and tags are not AND-ed in because most itineraries lack
      // complete metadata, so combining them would exclude too many results.
      where.destinations = {
        some: {
          OR: parsed.locationTerms.flatMap((term) => [
            { name: { contains: term, mode: 'insensitive' } },
            { country: { contains: term, mode: 'insensitive' } },
          ]),
        },
      }
    } else {
      // No location specified — audience and tags become the primary filters.
      if (parsed.audience) where.audience = parsed.audience
      if (parsed.tags.length > 0) where.tags = { hasSome: parsed.tags }
      if (parsed.maxBudget) where.budget = { lte: parsed.maxBudget }
    }

    const { itineraries, bucketSet } = await fetchItineraries(where, userId)

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">
          ← Explore
        </Link>
        <ExploreSearchBar />
        <SearchFiltersDisplay parsed={parsed} />
        <p className="text-sm text-gray-500 mb-4">
          {itineraries.length} result{itineraries.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
        </p>
        <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
      </div>
    )
  }

  // ── City view ──────────────────────────────────────────────────────────────
  if (country && city) {
    const { itineraries, bucketSet } = await fetchItineraries(
      { destinations: { some: { name: city, country } } },
      userId
    )
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link
          href={`/explore?country=${encodeURIComponent(country)}`}
          className="text-sm text-blue-600 hover:underline mb-5 inline-block"
        >
          ← {country}
        </Link>
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            {city}, {country}
          </h2>
          <p className="text-sm text-gray-500">
            {itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
      </div>
    )
  }

  // ── Country view ───────────────────────────────────────────────────────────
  if (country) {
    const destinations = await prisma.destination.findMany({
      where: { country, itinerary: { visibility: 'public' } },
      select: { name: true },
    })
    const cityMap = new Map<string, number>()
    for (const d of destinations) {
      cityMap.set(d.name, (cityMap.get(d.name) ?? 0) + 1)
    }
    const cities = [...cityMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">
          ← Explore
        </Link>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Globe size={18} className="text-blue-600" />
            {country}
          </h2>
          <p className="text-sm text-gray-500">
            {cities.length} destination{cities.length !== 1 ? 's' : ''}
          </p>
        </div>
        {cities.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No destinations yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cities.map(({ name, count }) => (
              <Link
                key={name}
                href={`/explore?country=${encodeURIComponent(country)}&city=${encodeURIComponent(name)}`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                      {name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {count} trip{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Trip type view ─────────────────────────────────────────────────────────
  if (type && TRIP_TYPE_META[type]) {
    const where =
      type === 'family' ? { audience: 'family' } :
      type === 'adult'  ? { audience: 'adult' }  :
      type === 'guide'  ? { postType: 'guide' }  :
      {}
    const { itineraries, bucketSet } = await fetchItineraries(where, userId)
    const meta = TRIP_TYPE_META[type]

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">
          ← Explore
        </Link>
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">
            {meta.emoji} {meta.label}
          </h2>
          <p className="text-sm text-gray-500">
            {itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
      </div>
    )
  }

  // ── Top-level explore ──────────────────────────────────────────────────────
  const allDestinations = await prisma.destination.findMany({
    where: { itinerary: { visibility: 'public' } },
    select: { country: true },
  })
  const countryMap = new Map<string, number>()
  for (const d of allDestinations) {
    if (d.country) {
      countryMap.set(d.country, (countryMap.get(d.country) ?? 0) + 1)
    }
  }
  const countries = [...countryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Explore</h2>
        <p className="text-sm text-gray-500">Discover destinations and trip types</p>
      </div>

      <ExploreSearchBar />

      {/* Trip types */}
      <section className="mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Browse by Trip Type</h3>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(TRIP_TYPE_META).map(([key, { label, emoji, desc }]) => (
            <Link
              key={key}
              href={`/explore?type=${key}`}
              className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="text-2xl mb-1">{emoji}</div>
              <p className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
                {label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Countries */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Browse by Destination</h3>
        {countries.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-3xl mb-3">🌍</p>
            <p className="text-sm text-gray-500">No destinations yet — be the first to post!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {countries.map(({ name, count }) => (
              <Link
                key={name}
                href={`/explore?country=${encodeURIComponent(name)}`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                      {name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {count} destination{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
