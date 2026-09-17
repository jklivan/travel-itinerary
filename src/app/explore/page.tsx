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
import { DAY_TRIP_TAG, isDayTrip } from '@/lib/dayTrips'
import { MapPin, Globe, ChevronRight, Users, MessagesSquare } from 'lucide-react'
import ExploreMap from '@/components/ExploreMap'
import ExploreTripFilters from '@/components/ExploreTripFilters'
import { parseExploreFilters, exploreFilterWhere } from '@/lib/exploreFilters'
import { Suspense } from 'react'

// ── Trip type meta (kept for ?type= URLs) ─────────────────────────────────────
const TRIP_TYPE_META: Record<string, { label: string; emoji: string; desc: string }> = {
  family: { label: 'Family', emoji: '👨‍👩‍👧', desc: 'Great for all ages' },
  adult:  { label: 'Adults', emoji: '🍷',   desc: 'Curated for adults' },
  friends:{ label: 'Friends', emoji: '🥳',  desc: 'Trips with friends' },
  romantic:{ label: 'Romantic', emoji: '💋', desc: 'Romantic getaways' },
}

// ── Region classifier ──────────────────────────────────────────────────────────
const REGION_ORDER = ['United States', 'Europe', 'Asia', 'Latin America', 'Caribbean & Bahamas', 'Middle East & Africa', 'Pacific & Oceania']

const COUNTRY_ALIASES: Record<string, string> = {
  'us': 'United States', 'usa': 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States',
  'america': 'United States', 'united states of america': 'United States',
  'uk': 'UK', 'great britain': 'UK', 'england': 'UK',
  'scotland': 'UK', 'wales': 'UK', 'united kingdom': 'UK',
  'uae': 'UAE', 'united arab emirates': 'UAE',
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
  if (['france', 'italy', 'spain', 'portugal', 'germany', 'netherlands', 'belgium', 'austria', 'switzerland', 'czech', 'hungary', 'poland', 'croatia', 'greece', 'turkey', 'kingdom', 'england', 'scotland', 'ireland', 'wales', 'norway', 'sweden', 'denmark', 'finland', 'iceland', 'romania', 'bulgaria', 'serbia', 'montenegro', 'slovenia', 'slovakia', 'estonia', 'latvia', 'lithuania', 'malta', 'luxembourg', 'monaco', 'albania', 'macedonia', 'bosnia', 'moldova', 'ukraine', 'cyprus', 'andorra', 'san marino', 'liechtenstein', 'uk'].some(x => c === x || c.includes(x))) return 'Europe'
  if (['japan', 'china', 'thailand', 'vietnam', 'indonesia', 'bali', 'philippines', 'south korea', 'korea', 'india', 'sri lanka', 'nepal', 'bhutan', 'singapore', 'malaysia', 'myanmar', 'cambodia', 'laos', 'taiwan', 'hong kong', 'maldives', 'bangladesh', 'pakistan', 'mongolia'].some(x => c.includes(x))) return 'Asia'
  if (['bahamas', 'jamaica', 'cuba', 'dominican', 'puerto rico', 'barbados', 'trinidad', 'saint lucia', 'st. lucia', 'antigua', 'grenada', 'martinique', 'guadeloupe', 'haiti', 'bermuda', 'cayman', 'turks and caicos', 'virgin islands', 'aruba', 'curacao', 'sint maarten', 'saint martin', 'anguilla', 'saint kitts'].some(x => c.includes(x))) return 'Caribbean & Bahamas'
  if (['mexico', 'colombia', 'peru', 'brazil', 'argentina', 'chile', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'venezuela', 'panama', 'costa rica', 'guatemala', 'belize', 'honduras', 'nicaragua', 'el salvador'].some(x => c.includes(x))) return 'Latin America'
  if (['uae', 'united arab emirates', 'dubai', 'saudi', 'qatar', 'bahrain', 'kuwait', 'oman', 'jordan', 'israel', 'egypt', 'morocco', 'tunisia', 'south africa', 'kenya', 'tanzania', 'ghana', 'nigeria', 'ethiopia', 'senegal', 'rwanda', 'uganda', 'mozambique', 'madagascar', 'mauritius', 'seychelles', 'zimbabwe', 'botswana', 'namibia', 'zambia'].some(x => c.includes(x))) return 'Middle East & Africa'
  if (['australia', 'new zealand', 'fiji', 'hawaii', 'french polynesia', 'tahiti', 'papua', 'samoa', 'tonga', 'vanuatu', 'new caledonia', 'cook islands'].some(x => c.includes(x))) return 'Pacific & Oceania'
  return 'Other'
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
async function fetchItineraries(where: ItineraryWhereInput, userId: string | null) {
  const tagFilter = where.tags
  const selectedTags = tagFilter && 'hasSome' in tagFilter && Array.isArray(tagFilter.hasSome) ? tagFilter.hasSome : tagFilter && 'has' in tagFilter && typeof tagFilter.has === 'string' ? [tagFilter.has] : []
  const includeDayTrips = selectedTags.includes(DAY_TRIP_TAG)
  const queryWhere = includeDayTrips ? { ...where, tags: undefined } : where
  const [rows, bucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: { visibility: { not: 'draft' }, destinations: { some: { items: { some: {} } } }, ...queryWhere },
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
  const itineraries = includeDayTrips ? rows.filter(trip => isDayTrip(trip) || selectedTags.some(tag => tag !== DAY_TRIP_TAG && trip.tags.includes(tag))) : rows
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
      <div className="text-center py-20 bg-[#FAF7F2] rounded-xl border border-[#E8D5B7]">
        <p className="text-4xl mb-4">🌍</p>
        <p className="text-base font-medium text-[#2C1810]">No trips here yet.</p>
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
        <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-[#E8D5B7] text-[#5C3D2E] font-medium">{c}</span>
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
    const isUS = row.canonical_country === 'United States'
    const normalizedName = isUS ? row.display_name.trim() : normalizeCountry(row.display_name.trim())
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
  'United States':        'from-[#7d9990] to-[#365f59]',
  'Europe':               'from-[#9aaa8c] to-[#536c57]',
  'Asia':                 'from-[#c0937d] to-[#825a49]',
  'Latin America':        'from-[#c4a882] to-[#876648]',
  'Caribbean & Bahamas':  'from-[#94b7b0] to-[#507c76]',
  'Middle East & Africa': 'from-[#c6b38e] to-[#907450]',
  'Pacific & Oceania':    'from-[#96aaa0] to-[#4e7368]',
  'Other':                'from-[#b3a591] to-[#7c6f60]',
}

// ── Main page ──────────────────────────────────────────────────────────────────
type ExploreParams = { country?: string; city?: string; type?: string; q?: string; view?: string; tag?: string; tags?: string; types?: string; region?: string }

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<ExploreParams>

}) {
  const params = await searchParams
  if (!Object.values(params).some(Boolean)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-[#2C1810] mb-2">Explore</h1>
        <p className="text-sm text-[#8B6F4E] mb-6">How would you like to find your next trip?</p>
        <div className="space-y-4">
          {[
            { href: '/explore?tag=day-trip', title: 'Day trips', description: 'One or two days away—quick escapes and overnight adventures.', Icon: MapPin },
            { href: '/explore/questions', title: 'Ask your friends', description: 'Ask a question, tag an itinerary, and swap travel advice.', Icon: MessagesSquare },
            { href: '/explore?view=tags', title: 'SEARCH BY TRIP TYPE', description: 'Family adventures, couples getaways, and trips with friends.', Icon: Users },
            { href: '/explore?view=destinations', title: 'SEARCH BY DESTINATION', description: 'Browse places around the world.', Icon: Globe },
          ].map(({ href, title, description, Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-4 rounded-2xl border border-[#C4A882] bg-[#FAF7F2] p-5 hover:bg-[#E8D5B7] transition-colors">
              <Icon size={28} className="shrink-0 text-[#507c76]" />
              <div className="flex-1"><h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-[#2C1810]">{title}</h2><p className="text-sm text-[#8B6F4E] mt-1">{description}</p></div>
              <ChevronRight size={20} className="shrink-0 text-[#8B6F4E]" />
            </Link>
          ))}
        </div>
      </div>
    )
  }
  return <Suspense key={JSON.stringify(params)} fallback={<div role="status" className="max-w-5xl mx-auto px-4 py-6">{params.q ? `Searching for “${params.q}”…` : 'Loading destinations…'}</div>}>
    <ExploreResults params={params} />
  </Suspense>
}

async function ExploreResults({ params }: { params: ExploreParams }) {
  const { country, city, type, q, view, tag, tags: tagsParam, region } = params
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
        <Link href="/explore" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">← Explore</Link>
        <ExploreSearchBar />
        <SearchFiltersDisplay parsed={parsed} />
        <p className="text-sm text-[#8B6F4E] mb-4">
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
        <Link href="/explore?view=tags" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">
          ← Browse by Type
        </Link>
        <div className="mb-5">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">
            {meta ? `${meta.emoji} ${meta.label}` : tag}
          </h2>
          {tag === DAY_TRIP_TAG && <p className="mt-2 mb-3 text-sm text-[#8B6F4E]">Ideas for 1–2 days away, including trips tagged by their authors.</p>}
          <p className="text-sm text-[#8B6F4E]">{itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}</p>
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
        <Link href={country === 'United States' ? '/explore?view=destinations' : `/explore?country=${encodeURIComponent(country)}`} className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">
          ← {country === 'United States' ? 'Destinations' : country}
        </Link>
        <div className="mb-5">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] flex items-center gap-2">
            <MapPin size={18} className="text-[#5C3D2E]" />
            {city}, {country}
          </h2>
          <p className="text-sm text-[#8B6F4E]">{itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}</p>
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

    type CityRow = { name: string; count: bigint; photo_url: string | null }
    const destinations = await prisma.$queryRaw<CityRow[]>(
      isUS
        ? Prisma.sql`
            WITH counts AS (
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
            ),
            photos AS (
              SELECT DISTINCT ON (d.name) d.name, p.url AS photo_url
              FROM "Destination" d
              JOIN "Itinerary" i ON i.id = d."itineraryId"
              JOIN "Photo" p ON p."itineraryId" = i.id
              WHERE i.visibility != 'draft'
                AND (
                  LOWER(d.country) = ANY(ARRAY['united states','us','usa','america','u.s.','u.s.a.','united states of america'])
                  OR d.country ILIKE '%United States%'
                  OR d.country ILIKE '%, USA'
                  OR d.country ILIKE '%, US'
                )
              ORDER BY d.name, p."isStock" ASC, p.id ASC
            )
            SELECT c.name, c.count, ph.photo_url
            FROM counts c
            LEFT JOIN photos ph ON ph.name = c.name
            ORDER BY c.count DESC
          `
        : Prisma.sql`
            WITH counts AS (
              SELECT d.name, COUNT(DISTINCT d."itineraryId") AS count
              FROM "Destination" d
              JOIN "Itinerary" i ON i.id = d."itineraryId"
              WHERE i.visibility != 'draft'
                AND d.name IS NOT NULL AND d.name != ''
                AND EXISTS (SELECT 1 FROM "DestItem" di WHERE di."destinationId" = d.id)
                AND LOWER(d.country) = ANY(${countryFilter.map(s => s.toLowerCase())})
              GROUP BY d.name
            ),
            photos AS (
              SELECT DISTINCT ON (d.name) d.name, p.url AS photo_url
              FROM "Destination" d
              JOIN "Itinerary" i ON i.id = d."itineraryId"
              JOIN "Photo" p ON p."itineraryId" = i.id
              WHERE i.visibility != 'draft'
                AND LOWER(d.country) = ANY(${countryFilter.map(s => s.toLowerCase())})
              ORDER BY d.name, p."isStock" ASC, p.id ASC
            )
            SELECT c.name, c.count, ph.photo_url
            FROM counts c
            LEFT JOIN photos ph ON ph.name = c.name
            ORDER BY c.count DESC
          `
    )
    const cities = destinations.map(d => ({ name: d.name, count: Number(d.count), photoUrl: d.photo_url }))
    const gradient = REGION_GRADIENT[getRegionLabel(country)] ?? 'from-[#b3a591] to-[#7c6f60]'
    const cityHref = (name: string) =>
      `/explore?country=${encodeURIComponent(country)}&city=${encodeURIComponent(name)}`

    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-10">
        <Link href="/explore" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">← Explore</Link>
        <div className="mb-5">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">{country}</h2>
          <p className="text-sm text-[#8B6F4E]">{cities.length} destination{cities.length !== 1 ? 's' : ''}</p>
        </div>
        {cities.length === 0 ? (
          <p className="text-sm text-[#8B6F4E] italic">No destinations yet.</p>
        ) : (
          <div className="space-y-3">
            {/* Hero — most popular city */}
            <Link href={cityHref(cities[0].name)} className="relative block h-48 rounded-2xl overflow-hidden">
              {cities[0].photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cities[0].photoUrl} alt={cities[0].name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-[family-name:var(--font-playfair)] text-white text-2xl leading-tight">{cities[0].name}</p>
                <p className="text-white/70 text-sm mt-0.5">{cities[0].count} trip{cities[0].count !== 1 ? 's' : ''}</p>
              </div>
            </Link>

            {/* Rest — 2-column photo grid */}
            {cities.length > 1 && (
              <div className="grid grid-cols-2 gap-3">
                {cities.slice(1).map(c => (
                  <Link key={c.name} href={cityHref(c.name)} className="relative h-32 rounded-2xl overflow-hidden block">
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <p className="font-[family-name:var(--font-playfair)] text-white text-base leading-tight">{c.name}</p>
                      <p className="text-white/70 text-xs mt-0.5">{c.count} trip{c.count !== 1 ? 's' : ''}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
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
      type === 'romantic' ? { audience: 'romantic' } : {}
    const { itineraries, bucketSet } = await fetchItineraries(where, userId)
    const meta = TRIP_TYPE_META[type]
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore?view=tags" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">← Trip types</Link>
        <div className="mb-5">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">{meta.emoji} {meta.label}</h2>
          <p className="text-sm text-[#8B6F4E]">{itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}</p>
        </div>
        <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
      </div>
    )
  }

  // ── view=tags ──────────────────────────────────────────────────────────────
  if (view === 'tags') {
    const filters = parseExploreFilters(params.types, tagsParam)
    const { itineraries, bucketSet } = await fetchItineraries(exploreFilterWhere(filters), userId)

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">← Explore</Link>
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl tracking-wide text-[#2C1810] mb-5">SEARCH BY TRIP TYPE</h1>
        <ExploreTripFilters key={`${filters.types.join(',')}|${filters.tags.join(',')}`} types={filters.types} tags={filters.tags} />
        <div className="mt-7">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-2">Trips to inspire you</h2>
          <p role="status" className="text-sm text-[#8B6F4E] mb-4">{itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}</p>
          <ItineraryList itineraries={itineraries} bucketSet={bucketSet} userId={userId} />
        </div>
      </div>
    )
  }

  // ── view=hotspots ──────────────────────────────────────────────────────────
  if (view === 'hotspots') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">← Explore</Link>
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🔥</p>
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-2">Hot Spots</h2>
          <p className="text-sm text-[#8B6F4E]">Coming soon</p>
        </div>
      </div>
    )
  }

  // ── view=recs ──────────────────────────────────────────────────────────────
  if (view === 'recs') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/explore" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">← Explore</Link>
        <div className="text-center py-24">
          <p className="text-5xl mb-4">👥</p>
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-2">Friends&apos; Trips</h2>
          <Link href="/friends" className="text-sm text-[#5C3D2E] hover:underline">See your friends</Link>
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
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#E8D5B7] bg-[#FAF7F2] shrink-0">
          <Link href="/explore" className="text-sm text-[#5C3D2E] hover:underline">← Explore</Link>
          <span className="text-sm text-[#8B6F4E]">{pins.length} place{pins.length !== 1 ? 's' : ''} mapped</span>
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
        <Link href="/explore?view=destinations" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">← Destinations</Link>
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-5">{region}</h1>
        {cards.length === 0 ? (
          <p className="text-sm text-[#8B6F4E] italic">No destinations yet.</p>
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
                    <div className={`w-full h-full bg-gradient-to-br ${REGION_GRADIENT[region] ?? 'from-[#b3a591] to-[#7c6f60]'}`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="font-[family-name:var(--font-playfair)] text-white text-base leading-tight">{c.displayName}</p>
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
      <Link href="/explore" className="text-sm text-[#5C3D2E] hover:underline mb-5 inline-block">← Explore</Link>
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-[#2C1810]">Destinations</h1>
      </div>

      <ExploreSearchBar />

      {destRegions.length === 0 ? (
        <div className="text-center py-20 text-[#8B6F4E] mt-6">
          <p className="text-4xl mb-3">🌍</p>
          <p className="text-sm">No destinations yet. <Link href="/create" className="text-[#5C3D2E] hover:underline">Add a trip!</Link></p>
        </div>
      ) : (
        <div className="space-y-8 mt-6">
          {destRegions.map(region => (
            <div key={region.label}>
              <div className="flex items-center justify-between mb-3">
                <Link href={`/explore?region=${encodeURIComponent(region.label)}`} className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] hover:text-[#5C3D2E] transition-colors">
                  {region.label}
                </Link>
                <Link href={`/explore?region=${encodeURIComponent(region.label)}`} className="text-sm text-[#5C3D2E] hover:underline">
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
                        <div className={`w-full h-full bg-gradient-to-br ${REGION_GRADIENT[region.label] ?? 'from-[#b3a591] to-[#7c6f60]'}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="font-[family-name:var(--font-playfair)] text-white text-base leading-tight">{c.displayName}</p>
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
