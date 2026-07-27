import { prisma } from '@/lib/prisma'
import type { ItineraryWhereInput } from '@/generated/prisma/models/Itinerary'
import { auth } from '@/auth'
import Link from 'next/link'
import ItineraryCard from '@/components/ItineraryCard'
import HorizontalScrollFeed from '@/components/HorizontalScrollFeed'
import ExploreSearchBar from '@/components/ExploreSearchBar'
import { parseSearchQuery, type ParsedQuery } from '@/lib/parseSearchQuery'
import { tagMeta, TAGS } from '@/lib/tags'
import { MapPin, Globe, ChevronRight } from 'lucide-react'
import { Caveat } from 'next/font/google'
import ExploreMap from '@/components/ExploreMap'

const caveat = Caveat({ subsets: ['latin'] })

// ── Trip type meta (kept for ?type= URLs) ─────────────────────────────────────
const TRIP_TYPE_META: Record<string, { label: string; emoji: string; desc: string }> = {
  family: { label: 'Family', emoji: '👨‍👩‍👧', desc: 'Great for all ages' },
  adult:  { label: 'Adults', emoji: '🍷',   desc: 'Curated for adults' },
  guide:  { label: 'Guides', emoji: '📖',   desc: 'Expert recommendations' },
}

// ── Nav polaroid definitions ───────────────────────────────────────────────────
const NAV_CARDS = [
  { key: 'tags',     href: '/explore?view=tags',     emoji: '🏷️', title: 'Browse by Type', desc: 'Filter by vibe',        bg: '#C4782A', tape: 'rgba(255,243,148,0.88)', rot: '-1.5deg' },
  { key: 'hotspots', href: '/explore?view=hotspots', emoji: '🔥', title: 'Hot Spots',      desc: "What's trending",       bg: '#B03020', tape: 'rgba(255,210,210,0.88)', rot:  '1.5deg' },
  { key: 'recs',     href: '/explore?view=recs',     emoji: '⭐', title: 'Expert Recs',    desc: 'Curated picks',          bg: '#1A4F7A', tape: 'rgba(200,232,255,0.88)', rot: '-0.5deg' },
  { key: 'map',      href: '/explore?view=map',      emoji: '🗺️', title: 'Map',            desc: 'Explore destinations',  bg: '#0F7A65', tape: 'rgba(210,255,220,0.88)', rot:  '2.0deg' },
]

// ── Shared helpers ─────────────────────────────────────────────────────────────
async function fetchItineraries(where: ItineraryWhereInput, userId: string | null) {
  const [itineraries, bucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: { visibility: 'public', destinations: { some: { items: { some: {} } } }, ...where },
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
  return { itineraries, bucketSet: new Set(bucketIds.map((b) => b.itineraryId)) }
}

function ItineraryList({
  itineraries, bucketSet, userId,
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

// ── Main page ──────────────────────────────────────────────────────────────────
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; city?: string; type?: string; q?: string; view?: string; tag?: string }>

}) {
  const { country, city, type, q, view, tag } = await searchParams
  const session = await auth()
  const userId = session?.user?.id ?? null

  // ── Natural language search ────────────────────────────────────────────────
  if (q) {
    const parsed = await parseSearchQuery(q)
    const where: ItineraryWhereInput = {}
    if (parsed.postType) where.postType = parsed.postType
    if (parsed.audience) where.audience = parsed.audience
    if (parsed.tags.length > 0) where.tags = { hasSome: parsed.tags }
    if (parsed.maxBudget) where.budget = { lte: parsed.maxBudget }
    if (parsed.locationTerms.length > 0) {
      where.destinations = {
        some: {
          OR: parsed.locationTerms.flatMap((term) => [
            { name: { contains: term, mode: 'insensitive' } },
            { country: { contains: term, mode: 'insensitive' } },
          ]),
        },
      }
    }

    console.log('[search] query:', q)
    console.log('[search] locationTerms:', parsed.locationTerms.join(' | '))
    console.log('[search] tags:', parsed.tags.join(' | '))
    console.log('[search] audience:', parsed.audience, 'budget:', parsed.maxBudget)

    const allDests = await prisma.destination.findMany({
      where: { itinerary: { visibility: 'public' } },
      select: { name: true, country: true },
    })
    console.log('[search] all destinations:', allDests.map(d => `"${d.name}" / "${d.country}"`).join(' | '))

    const { itineraries, bucketSet } = await fetchItineraries(where, userId)
    console.log('[search] result count:', itineraries.length)
    for (const it of itineraries) {
      console.log('[search] match:', it.title, '|', it.destinations.map(d => `${d.name} / ${d.country}`).join(', '))
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Explore</Link>
        <ExploreSearchBar />
        <SearchFiltersDisplay parsed={parsed} />
        <p className="text-sm text-gray-500 mb-4">
          {itineraries.length} result{itineraries.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
        </p>
        <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
      </div>
    )
  }

  // ── Tag-filtered results ───────────────────────────────────────────────────
  if (tag) {
    const meta = tagMeta(tag)
    const { itineraries, bucketSet } = await fetchItineraries({ tags: { has: tag } }, userId)
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore?view=tags" className="text-sm text-blue-600 hover:underline mb-5 inline-block">
          ← Browse by Type
        </Link>
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">
            {meta ? `${meta.emoji} ${meta.label}` : tag}
          </h2>
          <p className="text-sm text-gray-500">{itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}</p>
        </div>
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
        <Link href={`/explore?country=${encodeURIComponent(country)}`} className="text-sm text-blue-600 hover:underline mb-5 inline-block">
          ← {country}
        </Link>
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            {city}, {country}
          </h2>
          <p className="text-sm text-gray-500">{itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}</p>
        </div>
        <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
      </div>
    )
  }

  // ── Country view ───────────────────────────────────────────────────────────
  if (country) {
    const destinations = await prisma.destination.findMany({
      where: { country, itinerary: { visibility: 'public' }, items: { some: {} } },
      select: { name: true },
    })
    const cityMap = new Map<string, number>()
    for (const d of destinations) cityMap.set(d.name, (cityMap.get(d.name) ?? 0) + 1)
    const cities = [...cityMap.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Explore</Link>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Globe size={18} className="text-blue-600" />
            {country}
          </h2>
          <p className="text-sm text-gray-500">{cities.length} destination{cities.length !== 1 ? 's' : ''}</p>
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
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{count} trip{count !== 1 ? 's' : ''}</p>
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

  // ── Trip type view (legacy ?type= URLs) ────────────────────────────────────
  if (type && TRIP_TYPE_META[type]) {
    const where =
      type === 'family' ? { audience: 'family' } :
      type === 'adult'  ? { audience: 'adult' }  :
      type === 'guide'  ? { postType: 'guide' }  : {}
    const { itineraries, bucketSet } = await fetchItineraries(where, userId)
    const meta = TRIP_TYPE_META[type]
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Explore</Link>
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">{meta.emoji} {meta.label}</h2>
          <p className="text-sm text-gray-500">{itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}</p>
        </div>
        <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
      </div>
    )
  }

  // ── view=tags ──────────────────────────────────────────────────────────────
  if (view === 'tags') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Explore</Link>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Browse by Type</h2>
        <p className="text-sm text-gray-500 mb-6">Pick a vibe to explore trips</p>
        <div className="grid grid-cols-3 gap-3">
          {TAGS.map((t) => (
            <Link
              key={t.id}
              href={`/explore?tag=${t.id}`}
              className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="text-2xl mb-1.5">{t.emoji}</div>
              <p className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
                {t.label}
              </p>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // ── view=hotspots ──────────────────────────────────────────────────────────
  if (view === 'hotspots') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Explore</Link>
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🔥</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Hot Spots</h2>
          <p className="text-sm text-gray-400">Coming soon</p>
        </div>
      </div>
    )
  }

  // ── view=recs ──────────────────────────────────────────────────────────────
  if (view === 'recs') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Explore</Link>
        <div className="text-center py-24">
          <p className="text-5xl mb-4">⭐</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Expert Recs</h2>
          <p className="text-sm text-gray-400">Coming soon</p>
        </div>
      </div>
    )
  }

  // ── view=map ───────────────────────────────────────────────────────────────
  if (view === 'map') {
    const mapDests = await prisma.destination.findMany({
      where: {
        lat: { not: null },
        lng: { not: null },
        itinerary: { visibility: 'public' },
        items: { some: {} },
      },
      select: {
        lat: true, lng: true, name: true, country: true,
        itinerary: { select: { id: true, title: true } },
      },
    })
    const pins = mapDests.map((d) => ({
      lat: d.lat!,
      lng: d.lng!,
      destName: d.name,
      country: d.country,
      itineraryId: d.itinerary.id,
      itineraryTitle: d.itinerary.title,
    }))

    return (
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 3.5rem)' }}>
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white shrink-0">
          <Link href="/explore" className="text-sm text-blue-600 hover:underline">← Explore</Link>
          <span className="text-sm text-gray-400">{pins.length} place{pins.length !== 1 ? 's' : ''} mapped</span>
        </div>
        <div className="flex-1 min-h-0">
          <ExploreMap pins={pins} />
        </div>
      </div>
    )
  }

  // ── Top-level explore ──────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900">Explore</h2>
        <p className="text-sm text-gray-500">Discover trips around the world</p>
      </div>

      <ExploreSearchBar />

      <div className="grid grid-cols-2 gap-5 mt-2">
        {NAV_CARDS.map((card) => (
          <Link key={card.key} href={card.href} className="block relative pt-5 group">
            {/* Tape */}
            <div
              className="absolute top-1 left-1/2 z-10 w-12 h-6 rounded-[2px]"
              style={{
                backgroundColor: card.tape,
                transform: `translateX(-50%) rotate(${card.rot})`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
              }}
            />
            {/* Card */}
            <div
              className="bg-white rounded-[3px] px-4 pt-4 pb-5 transition-transform duration-150 group-hover:-translate-y-1"
              style={{ boxShadow: '2px 5px 18px rgba(0,0,0,0.14)' }}
            >
              {/* Photo area */}
              <div
                className="w-full aspect-[4/3] flex items-center justify-center text-5xl mb-3 rounded-[2px]"
                style={{ backgroundColor: card.bg }}
              >
                {card.emoji}
              </div>
              {/* Caption */}
              <h3 className={`${caveat.className} text-xl text-gray-900 leading-tight`}>
                {card.title}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
