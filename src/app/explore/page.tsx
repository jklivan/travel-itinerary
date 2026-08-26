import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import type { ItineraryWhereInput } from '@/generated/prisma/models/Itinerary'
import { auth } from '@/auth'
import Link from 'next/link'
import ItineraryCard from '@/components/ItineraryCard'
import HorizontalScrollFeed from '@/components/HorizontalScrollFeed'
import ExploreSearchBar from '@/components/ExploreSearchBar'
import { parseSearchQuery, type ParsedQuery } from '@/lib/parseSearchQuery'
import { tagMeta } from '@/lib/tags'
import { MapPin, Globe, ChevronRight } from 'lucide-react'
import ExploreMap from '@/components/ExploreMap'
import TagBrowser from '@/components/TagBrowser'

// ── Trip type meta (kept for ?type= URLs) ─────────────────────────────────────
const TRIP_TYPE_META: Record<string, { label: string; emoji: string; desc: string }> = {
  family: { label: 'Family', emoji: '👨‍👩‍👧', desc: 'Great for all ages' },
  adult:  { label: 'Adults', emoji: '🍷',   desc: 'Curated for adults' },
  friends:{ label: 'Friends', emoji: '🥳',  desc: 'Trips with friends' },
  romantic:{ label: 'Romantic', emoji: '💋', desc: 'Romantic getaways' },
  guide:  { label: 'Guides', emoji: '📖',   desc: 'Expert recommendations' },
}

// ── Region classifier ──────────────────────────────────────────────────────────
const REGION_ORDER = ['United States', 'Europe', 'Asia', 'Latin America', 'Caribbean & Bahamas', 'Middle East & Africa', 'Pacific & Oceania']

const COUNTRY_ALIASES: Record<string, string> = {
  'us': 'United States', 'usa': 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States',
  'america': 'United States', 'united states of america': 'United States',
  'uk': 'United Kingdom', 'great britain': 'United Kingdom', 'england': 'United Kingdom',
  'scotland': 'United Kingdom', 'wales': 'United Kingdom',
  'uae': 'United Arab Emirates',
  'south korea': 'South Korea', 'republic of korea': 'South Korea',
  'north korea': 'North Korea',
  'russia': 'Russia', 'russian federation': 'Russia',
  'czechia': 'Czech Republic',
  'türkiye': 'Turkey',
}

function normalizeCountry(raw: string): string {
  return COUNTRY_ALIASES[raw.trim().toLowerCase()] ?? raw.trim()
}

function getRegionLabel(country: string): string {
  const c = country.toLowerCase()
  if (['united states', 'usa', ' us,', 'america'].some(x => c.includes(x)) || c === 'us') return 'United States'
  if (['france', 'italy', 'spain', 'portugal', 'germany', 'netherlands', 'belgium', 'austria', 'switzerland', 'czech', 'hungary', 'poland', 'croatia', 'greece', 'turkey', 'kingdom', 'england', 'scotland', 'ireland', 'wales', 'norway', 'sweden', 'denmark', 'finland', 'iceland', 'romania', 'bulgaria', 'serbia', 'montenegro', 'slovenia', 'slovakia', 'estonia', 'latvia', 'lithuania', 'malta', 'luxembourg', 'monaco', 'albania', 'macedonia', 'bosnia', 'moldova', 'ukraine', 'cyprus', 'andorra', 'san marino', 'liechtenstein'].some(x => c.includes(x))) return 'Europe'
  if (['japan', 'china', 'thailand', 'vietnam', 'indonesia', 'bali', 'philippines', 'south korea', 'korea', 'india', 'sri lanka', 'nepal', 'bhutan', 'singapore', 'malaysia', 'myanmar', 'cambodia', 'laos', 'taiwan', 'hong kong', 'maldives', 'bangladesh', 'pakistan', 'mongolia'].some(x => c.includes(x))) return 'Asia'
  if (['bahamas', 'jamaica', 'cuba', 'dominican', 'puerto rico', 'barbados', 'trinidad', 'saint lucia', 'st. lucia', 'antigua', 'grenada', 'martinique', 'guadeloupe', 'haiti', 'bermuda', 'cayman', 'turks and caicos', 'virgin islands', 'aruba', 'curacao', 'sint maarten', 'saint martin', 'anguilla', 'saint kitts'].some(x => c.includes(x))) return 'Caribbean & Bahamas'
  if (['mexico', 'colombia', 'peru', 'brazil', 'argentina', 'chile', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'venezuela', 'panama', 'costa rica', 'guatemala', 'belize', 'honduras', 'nicaragua', 'el salvador'].some(x => c.includes(x))) return 'Latin America'
  if (['uae', 'united arab emirates', 'dubai', 'saudi', 'qatar', 'bahrain', 'kuwait', 'oman', 'jordan', 'israel', 'egypt', 'morocco', 'tunisia', 'south africa', 'kenya', 'tanzania', 'ghana', 'nigeria', 'ethiopia', 'senegal', 'rwanda', 'uganda', 'mozambique', 'madagascar', 'mauritius', 'seychelles', 'zimbabwe', 'botswana', 'namibia', 'zambia'].some(x => c.includes(x))) return 'Middle East & Africa'
  if (['australia', 'new zealand', 'fiji', 'hawaii', 'french polynesia', 'tahiti', 'papua', 'samoa', 'tonga', 'vanuatu', 'new caledonia', 'cook islands'].some(x => c.includes(x))) return 'Pacific & Oceania'
  return 'Other'
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
async function fetchItineraries(where: ItineraryWhereInput, userId: string | null) {
  const [itineraries, bucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: { visibility: { not: 'draft' }, destinations: { some: { items: { some: {} } } }, ...where },
      orderBy: { createdAt: 'desc' },
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
          saveCount={it._count.bucketedBy}
        />
      ))}
    </HorizontalScrollFeed>
  )
}

function SearchFiltersDisplay({ parsed }: { parsed: ParsedQuery }) {
  const chips: string[] = []
  if (parsed.audience === 'family') chips.push('👨‍👩‍👧 Family')
  if (parsed.audience === 'adult') chips.push('🍷 Adults')
  if (parsed.audience === 'friends') chips.push('🥳 Friends')
  if (parsed.audience === 'romantic') chips.push('💋 Romantic')
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

// ── Shared SQL for destinations browser ────────────────────────────────────────
type DestRow = { display_name: string; canonical_country: string; trip_count: bigint; photo_url: string | null }
type DestCard = { displayName: string; tripCount: number; photoUrl: string | null }

const DEST_SQL = Prisma.sql`
  WITH display_data AS (
    SELECT
      CASE
        WHEN LOWER(TRIM(d.country)) = ANY(ARRAY['united states','us','usa','america','u.s.','u.s.a.','united states of america'])
             OR d.country ILIKE '%United States%'
             OR d.country ILIKE '%, USA'
             OR d.country ILIKE '%, US'
        THEN TRIM(d.name)
        ELSE INITCAP(LOWER(TRIM(d.country)))
      END AS display_name,
      CASE
        WHEN LOWER(TRIM(d.country)) = ANY(ARRAY['united states','us','usa','america','u.s.','u.s.a.','united states of america'])
             OR d.country ILIKE '%United States%'
             OR d.country ILIKE '%, USA'
             OR d.country ILIKE '%, US'
        THEN 'United States'
        ELSE INITCAP(LOWER(TRIM(d.country)))
      END AS canonical_country,
      d."itineraryId"
    FROM "Destination" d
    JOIN "Itinerary" i ON i.id = d."itineraryId"
    WHERE i.visibility != 'draft'
      AND d.country IS NOT NULL AND d.country != ''
      AND d.name   IS NOT NULL AND d.name   != ''
      AND EXISTS (SELECT 1 FROM "DestItem" di WHERE di."destinationId" = d.id)
  ),
  trip_counts AS (
    SELECT display_name, canonical_country, COUNT(DISTINCT "itineraryId") AS trip_count
    FROM display_data
    GROUP BY display_name, canonical_country
  ),
  photo_source AS (
    SELECT DISTINCT ON (dd.display_name) dd.display_name, p.url AS photo_url
    FROM display_data dd
    JOIN "Photo" p ON p."itineraryId" = dd."itineraryId"
    ORDER BY dd.display_name, p."isStock" ASC, p.id ASC
  )
  SELECT tc.display_name, tc.canonical_country, tc.trip_count, ps.photo_url
  FROM trip_counts tc
  LEFT JOIN photo_source ps ON ps.display_name = tc.display_name
  ORDER BY tc.canonical_country, tc.trip_count DESC
`

function buildRegionMap(rows: DestRow[]): Map<string, DestCard[]> {
  const map = new Map<string, DestCard[]>()
  for (const row of rows) {
    const canonical = row.canonical_country === 'United States'
      ? 'United States'
      : normalizeCountry(row.canonical_country)
    const region = getRegionLabel(canonical)
    if (!map.has(region)) map.set(region, [])
    const normalizedName = row.display_name.trim()
    const existing = map.get(region)!.find(x => x.displayName.toLowerCase() === normalizedName.toLowerCase())
    if (existing) {
      existing.tripCount += Number(row.trip_count)
      existing.photoUrl ??= row.photo_url
    } else {
      map.get(region)!.push({ displayName: normalizedName, tripCount: Number(row.trip_count), photoUrl: row.photo_url })
    }
  }
  return map
}

const REGION_GRADIENT: Record<string, string> = {
  'United States':        'from-blue-500 to-indigo-700',
  'Europe':               'from-emerald-500 to-teal-700',
  'Asia':                 'from-red-400 to-rose-700',
  'Latin America':        'from-orange-400 to-amber-600',
  'Caribbean & Bahamas':  'from-cyan-400 to-blue-600',
  'Middle East & Africa': 'from-yellow-500 to-orange-700',
  'Pacific & Oceania':    'from-teal-400 to-cyan-700',
  'Other':                'from-gray-400 to-gray-600',
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; city?: string; type?: string; q?: string; view?: string; tag?: string; tags?: string; region?: string }>

}) {
  const { country, city, type, q, view, tag, tags: tagsParam, region } = await searchParams
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
      where: { itinerary: { visibility: { not: 'draft' } } },
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
    const cityAliases = Object.entries(COUNTRY_ALIASES)
      .filter(([, canonical]) => canonical === country)
      .map(([alias]) => alias)
    const cityCountryFilter = [country, ...cityAliases]
    const cityCountryWhere = country === 'United States'
      ? { OR: [
          { country: { in: cityCountryFilter, mode: 'insensitive' as const } },
          { country: { contains: 'United States', mode: 'insensitive' as const } },
          { country: { endsWith: ', USA', mode: 'insensitive' as const } },
          { country: { endsWith: ', US', mode: 'insensitive' as const } },
        ] }
      : { country: { in: cityCountryFilter, mode: 'insensitive' as const } }
    const { itineraries, bucketSet } = await fetchItineraries(
      { destinations: { some: { name: city, ...cityCountryWhere } } },
      userId
    )
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href={country === 'United States' ? '/explore' : `/explore?country=${encodeURIComponent(country)}`} className="text-sm text-blue-600 hover:underline mb-5 inline-block">
          ← {country === 'United States' ? 'Destinations' : country}
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
    const isUS = country === 'United States'
    const countryAliases = Object.entries(COUNTRY_ALIASES)
      .filter(([, canonical]) => canonical === country)
      .map(([alias]) => alias)
    const countryFilter = [country, ...countryAliases]

    const destinations = await prisma.$queryRaw<{ name: string; count: bigint }[]>(
      isUS
        ? Prisma.sql`
            SELECT d.name, COUNT(DISTINCT d."itineraryId") AS count
            FROM "Destination" d
            JOIN "Itinerary" i ON i.id = d."itineraryId"
            WHERE i.visibility != 'draft'
              AND d.name IS NOT NULL AND d.name != ''
              AND EXISTS (SELECT 1 FROM "DestItem" di WHERE di."destinationId" = d.id)
              AND (
                LOWER(d.country) = ANY(ARRAY['united states','us','usa','america','u.s.','u.s.a.','united states of america'])
                OR d.country ILIKE '%United States%'
                OR d.country ILIKE '%, USA'
                OR d.country ILIKE '%, US'
              )
            GROUP BY d.name
          `
        : Prisma.sql`
            SELECT d.name, COUNT(DISTINCT d."itineraryId") AS count
            FROM "Destination" d
            JOIN "Itinerary" i ON i.id = d."itineraryId"
            WHERE i.visibility != 'draft'
              AND d.name IS NOT NULL AND d.name != ''
              AND EXISTS (SELECT 1 FROM "DestItem" di WHERE di."destinationId" = d.id)
              AND LOWER(d.country) = ANY(${countryFilter.map(s => s.toLowerCase())})
            GROUP BY d.name
          `
    )
    const cities = [...destinations]
      .sort((a, b) => Number(b.count) - Number(a.count))
      .map(d => ({ name: d.name, count: Number(d.count) }))

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
      type === 'friends' ? { audience: 'friends' } :
      type === 'romantic' ? { audience: 'romantic' } :
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
    const selectedTags = tagsParam ? tagsParam.split(',').filter(Boolean) : []
    const { itineraries, bucketSet } = selectedTags.length > 0
      ? await fetchItineraries({ tags: { hasSome: selectedTags } }, userId)
      : { itineraries: [], bucketSet: new Set<string>() }

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Explore</Link>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Browse by Type</h2>
        <p className="text-sm text-gray-500 mb-4">Pick one or more vibes</p>
        <TagBrowser selected={selectedTags} />
        {selectedTags.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-gray-500 mb-4">
              {itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}
            </p>
            <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
          </div>
        )}
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
          <p className="text-5xl mb-4">👥</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Friends&apos; Trips</h2>
          <Link href="/friends" className="text-sm text-blue-600 hover:underline">See your friends</Link>
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
        itinerary: { visibility: { not: 'draft' } },
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

  // ── Region view ────────────────────────────────────────────────────────────────
  if (region) {
    const rows = await prisma.$queryRaw<DestRow[]>(DEST_SQL)
    const regionMap = buildRegionMap(rows)
    const cards = regionMap.get(region) ?? []

    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-10">
        <Link href="/explore" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Destinations</Link>
        <h1 className="text-xl font-bold text-gray-900 mb-5">{region}</h1>
        {cards.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No destinations yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cards.map(c => {
              const href = region === 'United States'
                ? `/explore?country=United+States&city=${encodeURIComponent(c.displayName)}`
                : `/explore?country=${encodeURIComponent(c.displayName)}`
              return (
                <Link key={c.displayName} href={href} className="relative h-32 rounded-2xl overflow-hidden block">
                  {c.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photoUrl} alt={c.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${REGION_GRADIENT[region] ?? 'from-gray-400 to-gray-600'}`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-white font-semibold text-sm leading-tight">{c.displayName}</p>
                    <p className="text-white/70 text-xs mt-0.5">{c.tripCount} trip{c.tripCount !== 1 ? 's' : ''}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Top-level explore: destinations browser ───────────────────────────────────
  const destRows = await prisma.$queryRaw<DestRow[]>(DEST_SQL)
  const destRegionMap = buildRegionMap(destRows)
  const destRegions = REGION_ORDER
    .map(label => ({ label, cards: destRegionMap.get(label) ?? [] }))
    .filter(r => r.cards.length > 0)
  const otherCards = destRegionMap.get('Other') ?? []
  if (otherCards.length > 0) destRegions.push({ label: 'Other', cards: otherCards })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-10">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Destinations</h1>
      </div>

      <ExploreSearchBar />

      {destRegions.length === 0 ? (
        <div className="text-center py-20 text-gray-400 mt-6">
          <p className="text-4xl mb-3">🌍</p>
          <p className="text-sm">No destinations yet. <Link href="/create" className="text-blue-600 hover:underline">Add a trip!</Link></p>
        </div>
      ) : (
        <div className="space-y-8 mt-6">
          {destRegions.map(region => (
            <div key={region.label}>
              <div className="flex items-center justify-between mb-3">
                <Link href={`/explore?region=${encodeURIComponent(region.label)}`} className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
                  {region.label}
                </Link>
                <Link href={`/explore?region=${encodeURIComponent(region.label)}`} className="text-sm text-blue-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {region.cards.map(c => {
                  const href = region.label === 'United States'
                    ? `/explore?country=United+States&city=${encodeURIComponent(c.displayName)}`
                    : `/explore?country=${encodeURIComponent(c.displayName)}`
                  return (
                    <Link
                      key={c.displayName}
                      href={href}
                      className="relative flex-shrink-0 w-44 h-28 rounded-2xl overflow-hidden block"
                    >
                      {c.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photoUrl} alt={c.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${REGION_GRADIENT[region.label] ?? 'from-gray-400 to-gray-600'}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="text-white font-semibold text-sm leading-tight">{c.displayName}</p>
                        <p className="text-white/70 text-xs mt-0.5">{c.tripCount} trip{c.tripCount !== 1 ? 's' : ''}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
