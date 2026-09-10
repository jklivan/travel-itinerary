import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'
import { Hotel, Utensils, Camera, MapPin, Star, Check, Ban, BedDouble } from 'lucide-react'
import BucketButton from '@/components/BucketButton'
import { eventPhotos, pickEventPhoto, tripPhotoGallery } from '@/lib/eventPhotos'
import PhotoStrip from '@/components/PhotoStrip'
import { tagMeta } from '@/lib/tags'
import DeleteButton from '@/components/DeleteButton'
import Comments from '@/components/Comments'
import { TRIP_STAMPS } from '@/lib/tripStamps'
import ItineraryMap from '@/components/ItineraryMap'
import type { ItemPin } from '@/components/ItineraryMapInner'
import styles from './places.module.css'
import PlaceDetailsCard from '@/components/PlaceDetailsCard'
import { getRecommendation } from '@/lib/placeRecommendation'
import { mapDayNumber } from '@/lib/mapDays'

function FriendProof({
  friends,
  avg,
  total,
  verb = 'also went',
}: {
  friends: { friendName: string; rating: number | null; itineraryId: string }[]
  avg: number | null
  total: number
  verb?: string
}) {
  const ratedFriends = friends.filter(friend => friend.rating != null && friend.rating > 0)
  const friendAverage = ratedFriends.length > 0
    ? ratedFriends.reduce((sum, friend) => sum + friend.rating!, 0) / ratedFriends.length
    : null
  if (friends.length === 0 && (avg === null || total === 0)) return null

  const renderFriend = (friend: typeof friends[number], index: number) => (
    <div key={`${friend.itineraryId}-${index}`} className={styles.friendRow}>
      <span className={styles.friendName}>{friend.friendName.split(' ')[0]}</span>
      {friend.rating != null && friend.rating > 0 ? (
        <span className={styles.rating} aria-label={`${friend.rating} out of 5 stars`}><Star size={11} aria-hidden="true" />{friend.rating.toFixed(1)}</span>
      ) : <span>{verb}</span>}
      <Link href={`/itinerary/${friend.itineraryId}`} className={styles.friendLink}>their trip</Link>
    </div>
  )

  return (
    <div className={styles.socialProof}>
      {friends.length === 1 ? renderFriend(friends[0], 0) : friends.length > 1 ? (
        <details className={styles.friendDetails}>
          <summary>
            <span>{friends.length} friends {verb}</span>
            {friendAverage !== null && <span className={styles.rating} aria-label={`Friends average ${friendAverage.toFixed(1)} out of 5 from ${ratedFriends.length} ratings`}><Star size={11} aria-hidden="true" />{friendAverage.toFixed(1)} friends’ avg</span>}
          </summary>
          <div className={styles.friendList}>{friends.map(renderFriend)}</div>
        </details>
      ) : null}
      {avg !== null && total > 0 && (
        <p className={styles.communityRating}><span className={styles.rating}><Star size={11} aria-hidden="true" />{avg.toFixed(1)}</span> Community · {total} {total === 1 ? 'rating' : 'ratings'}</p>
      )}
    </div>
  )
}

type DestItemRow = { id: string; type: string; mealType?: string | null; name: string; description?: string | null; notes?: string | null; address?: string | null; rating?: number | null; priceLevel?: number | null; familyFriendly?: boolean | null; link?: string | null; groupIndex?: number; dayIndex?: number | null; tags?: string[]; alternative?: string | null; photoUrl?: string | null; photoUrls?: string[]; lat?: number | null; lng?: number | null; placeId?: string | null }

function groupItems(items: DestItemRow[]) {
  const stays = new Map<number, { hotel: DestItemRow | null; days: Map<number, DestItemRow[]> }>()
  for (const item of items) {
    const gi = item.groupIndex ?? 0
    if (!stays.has(gi)) stays.set(gi, { hotel: null, days: new Map() })
    const stay = stays.get(gi)!
    if (item.type === 'hotel') {
      stay.hotel = item
    } else {
      const di = item.dayIndex ?? 0
      if (!stay.days.has(di)) stay.days.set(di, [])
      stay.days.get(di)!.push(item)
    }
  }
  return [...stays.entries()].sort(([a], [b]) => a - b).map(([, stay]) => ({
    hotel: stay.hotel,
    days: [...stay.days.entries()].sort(([a], [b]) => a - b).map(([dayIndex, items]) => ({ dayIndex, items })),
  }))
}

const PLACE_CATEGORIES = {
  hotel: { label: 'Hotels', eyebrow: 'Stay', Icon: Hotel },
  food_drink: { label: 'Restaurants', eyebrow: 'Food & drink', Icon: Utensils },
  activity: { label: 'Activities', eyebrow: 'Explore', Icon: Camera },
} as const

type PlaceCategory = keyof typeof PLACE_CATEGORIES

function CategoryHeading({ type, count }: { type: PlaceCategory; count: number }) {
  const { label, Icon } = PLACE_CATEGORIES[type]
  return (
    <div className={`${styles.categoryHeading} ${styles[type]}`}>
      <h3><span className={styles.categoryIcon}><Icon size={16} strokeWidth={1.5} /></span>{label}</h3>
      <span className={styles.count}>{count} {count === 1 ? 'place' : 'places'}</span>
    </div>
  )
}

export default async function ItineraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { id } = await params
  const { view } = await searchParams
  const session = await auth()

  const it = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      destinations: {
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      },
      photos: { orderBy: { isStock: 'asc' } },
    },
  })

  if (!it) notFound()

  const isOwn = session?.user?.id === it.user.id
  const isGuide = it.postType === 'guide'
  const hasDailyPlan = !isGuide && it.destinations.some(dest => dest.items.some(item => item.type !== 'hotel' && item.dayIndex != null))
  const showDayByDay = view === 'day-by-day' && hasDailyPlan
  const showMap = view === 'map'

  if (it.visibility === 'draft' && !isOwn) notFound()


  const [followRecord, bucketItem, comments] = await Promise.all([
    session?.user?.id && !isOwn
      ? prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: session.user.id, followingId: it.user.id } },
        })
      : Promise.resolve(null),
    session?.user?.id && !isOwn
      ? prisma.bucketListItem.findUnique({
          where: { userId_itineraryId: { userId: session.user.id, itineraryId: id } },
        })
      : Promise.resolve(null),
    prisma.comment.findMany({
      where: { itineraryId: id, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
  ])
  const followStatus = followRecord?.status ?? 'none'
  const isBucketed = !!bucketItem

  // Social proof data
  const destNamesLower = it.destinations.map(d => d.name.toLowerCase())
  const hotelNamesLower = it.destinations.flatMap(d =>
    d.items.filter(i => i.type === 'hotel' && i.name).map(i => i.name.toLowerCase())
  )
  const foodNamesLower = it.destinations.flatMap(d =>
    d.items.filter(i => i.type === 'food_drink' && i.name).map(i => i.name.toLowerCase())
  )
  const activityNamesLower = it.destinations.flatMap(d =>
    d.items.filter(i => i.type === 'activity' && i.name).map(i => i.name.toLowerCase())
  )

  // placeId → canonical name (from this itinerary) for placeId-based matching
  const hotelPlaceIdToName = new Map<string, string>()
  const foodPlaceIdToName = new Map<string, string>()
  const activityPlaceIdToName = new Map<string, string>()
  for (const d of it.destinations) {
    for (const item of d.items) {
      if (item.placeId) {
        if (item.type === 'hotel') hotelPlaceIdToName.set(item.placeId, item.name.toLowerCase())
        if (item.type === 'food_drink') foodPlaceIdToName.set(item.placeId, item.name.toLowerCase())
        if (item.type === 'activity') activityPlaceIdToName.set(item.placeId, item.name.toLowerCase())
      }
    }
  }
  const hotelPlaceIds = [...hotelPlaceIdToName.keys()]
  const foodPlaceIds = [...foodPlaceIdToName.keys()]
  const activityPlaceIds = [...activityPlaceIdToName.keys()]

  const friendIds: string[] = session?.user?.id
    ? (await prisma.follow.findMany({
        where: { followerId: session.user.id, status: 'accepted' },
        select: { followingId: true },
      })).map(f => f.followingId)
    : []

  type SocialRow = { name: string; count: bigint }
  type FriendNameRow = { name: string; friend_name: string }
  type FriendDetailRow = { name: string; friend_name: string; rating: number | null; itinerary_id: string; place_id: string | null }
  type AvgRow = { item_id: string; total: bigint; avg_rating: number | null }
  type BucketerRow = { friend_name: string }

  const [friendDestRows, savedDestRows, friendHotelRows, friendFoodRows, friendActivityRows, placeAvgRows, itineraryBucketersRows] = await Promise.all([
    // Which friends visited the same destinations (exclude the current itinerary itself)
    friendIds.length > 0 && destNamesLower.length > 0
      ? prisma.$queryRaw<FriendNameRow[]>(Prisma.sql`
          SELECT DISTINCT ON (LOWER(d.name), i."userId") LOWER(d.name) AS name, u.name AS friend_name
          FROM "Destination" d
          JOIN "Itinerary" i ON i.id = d."itineraryId"
          JOIN "User" u ON u.id = i."userId"
          WHERE i."userId" IN (${Prisma.join(friendIds)})
            AND LOWER(d.name) IN (${Prisma.join(destNamesLower)})
            AND i.visibility != 'draft'
            AND i.id != ${id}
          ORDER BY LOWER(d.name), i."userId"
        `)
      : Promise.resolve([] as FriendNameRow[]),
    // How many travelers saved itineraries containing each destination
    destNamesLower.length > 0
      ? prisma.$queryRaw<SocialRow[]>(Prisma.sql`
          SELECT LOWER(d.name) AS name, COUNT(DISTINCT b."userId") AS count
          FROM "BucketListItem" b
          JOIN "Itinerary" i ON i.id = b."itineraryId"
          JOIN "Destination" d ON d."itineraryId" = i.id
          WHERE LOWER(d.name) IN (${Prisma.join(destNamesLower)})
            AND i.visibility != 'draft'
          GROUP BY LOWER(d.name)
        `)
      : Promise.resolve([] as SocialRow[]),
    // Which friends stayed at the same hotels + their ratings (exclude current itinerary, one row per friend per place)
    // Matches by name (case-insensitive) OR by placeId for cross-spelling detection
    friendIds.length > 0 && (hotelNamesLower.length > 0 || hotelPlaceIds.length > 0)
      ? prisma.$queryRaw<FriendDetailRow[]>(Prisma.sql`
          SELECT DISTINCT ON (LOWER(di.name), i."userId") LOWER(di.name) AS name, u.name AS friend_name, di.rating, i.id AS itinerary_id, di."placeId" AS place_id
          FROM "DestItem" di
          JOIN "Destination" d ON d.id = di."destinationId"
          JOIN "Itinerary" i ON i.id = d."itineraryId"
          JOIN "User" u ON u.id = i."userId"
          WHERE i."userId" IN (${Prisma.join(friendIds)})
            AND di.type = 'hotel'
            AND i.visibility != 'draft'
            AND i.id != ${id}
            AND (
              ${hotelNamesLower.length > 0 ? Prisma.sql`LOWER(di.name) IN (${Prisma.join(hotelNamesLower)})` : Prisma.sql`FALSE`}
              OR
              ${hotelPlaceIds.length > 0 ? Prisma.sql`(di."placeId" IS NOT NULL AND di."placeId" IN (${Prisma.join(hotelPlaceIds)}))` : Prisma.sql`FALSE`}
            )
          ORDER BY LOWER(di.name), i."userId", di.rating DESC NULLS LAST
        `)
      : Promise.resolve([] as FriendDetailRow[]),
    // Which friends ate at the same restaurants + their ratings (exclude current itinerary, one row per friend per place)
    // Matches by name (case-insensitive) OR by placeId for cross-spelling detection
    friendIds.length > 0 && (foodNamesLower.length > 0 || foodPlaceIds.length > 0)
      ? prisma.$queryRaw<FriendDetailRow[]>(Prisma.sql`
          SELECT DISTINCT ON (LOWER(di.name), i."userId") LOWER(di.name) AS name, u.name AS friend_name, di.rating, i.id AS itinerary_id, di."placeId" AS place_id
          FROM "DestItem" di
          JOIN "Destination" d ON d.id = di."destinationId"
          JOIN "Itinerary" i ON i.id = d."itineraryId"
          JOIN "User" u ON u.id = i."userId"
          WHERE i."userId" IN (${Prisma.join(friendIds)})
            AND di.type = 'food_drink'
            AND i.visibility != 'draft'
            AND i.id != ${id}
            AND (
              ${foodNamesLower.length > 0 ? Prisma.sql`LOWER(di.name) IN (${Prisma.join(foodNamesLower)})` : Prisma.sql`FALSE`}
              OR
              ${foodPlaceIds.length > 0 ? Prisma.sql`(di."placeId" IS NOT NULL AND di."placeId" IN (${Prisma.join(foodPlaceIds)}))` : Prisma.sql`FALSE`}
            )
          ORDER BY LOWER(di.name), i."userId", di.rating DESC NULLS LAST
        `)
      : Promise.resolve([] as FriendDetailRow[]),
    // Which friends did the same activities (exclude current itinerary, one row per friend per place)
    friendIds.length > 0 && (activityNamesLower.length > 0 || activityPlaceIds.length > 0)
      ? prisma.$queryRaw<FriendDetailRow[]>(Prisma.sql`
          SELECT DISTINCT ON (LOWER(di.name), i."userId") LOWER(di.name) AS name, u.name AS friend_name, di.rating, i.id AS itinerary_id, di."placeId" AS place_id
          FROM "DestItem" di
          JOIN "Destination" d ON d.id = di."destinationId"
          JOIN "Itinerary" i ON i.id = d."itineraryId"
          JOIN "User" u ON u.id = i."userId"
          WHERE i."userId" IN (${Prisma.join(friendIds)})
            AND di.type = 'activity'
            AND i.visibility != 'draft'
            AND i.id != ${id}
            AND (
              ${activityNamesLower.length > 0 ? Prisma.sql`LOWER(di.name) IN (${Prisma.join(activityNamesLower)})` : Prisma.sql`FALSE`}
              OR
              ${activityPlaceIds.length > 0 ? Prisma.sql`(di."placeId" IS NOT NULL AND di."placeId" IN (${Prisma.join(activityPlaceIds)}))` : Prisma.sql`FALSE`}
            )
          ORDER BY LOWER(di.name), i."userId", di.rating DESC NULLS LAST
        `)
      : Promise.resolve([] as FriendDetailRow[]),
    // Match every current place to published ratings by place ID or name.
    // Key by item ID so spelling variants resolve to the correct card.
    prisma.$queryRaw<AvgRow[]>(Prisma.sql`
      SELECT current_item.id AS item_id, COUNT(rated.id) AS total,
        AVG(rated.rating::float) AS avg_rating
      FROM "DestItem" current_item
      JOIN "Destination" current_dest ON current_dest.id = current_item."destinationId"
      JOIN "DestItem" rated ON rated.type = current_item.type
        AND (
          (current_item."placeId" IS NOT NULL AND rated."placeId" = current_item."placeId")
          OR LOWER(rated.name) = LOWER(current_item.name)
        )
      JOIN "Destination" rated_dest ON rated_dest.id = rated."destinationId"
      JOIN "Itinerary" rated_trip ON rated_trip.id = rated_dest."itineraryId"
      WHERE current_dest."itineraryId" = ${id}
        AND rated_trip.visibility != 'draft'
        AND rated.rating > 0
      GROUP BY current_item.id
    `),
    // Which friends saved this specific itinerary
    friendIds.length > 0
      ? prisma.$queryRaw<BucketerRow[]>(Prisma.sql`
          SELECT u.name AS friend_name
          FROM "BucketListItem" b
          JOIN "User" u ON u.id = b."userId"
          WHERE b."itineraryId" = ${id}
            AND b."userId" IN (${Prisma.join(friendIds)})
        `)
      : Promise.resolve([] as BucketerRow[]),
  ])

  // destination name → [friend names]
  const friendDestNames = new Map<string, string[]>()
  for (const r of friendDestRows) {
    if (!friendDestNames.has(r.name)) friendDestNames.set(r.name, [])
    friendDestNames.get(r.name)!.push(r.friend_name)
  }
  const savedDestMap = new Map(savedDestRows.map(r => [r.name, Number(r.count)]))

  // hotel/food name → [{friendName, rating, itineraryId}]
  // When matched by placeId, use the current itinerary's canonical name as key so render lookup works correctly
  const friendHotelDetails = new Map<string, { friendName: string; rating: number | null; itineraryId: string }[]>()
  for (const r of friendHotelRows) {
    const key = (r.place_id && hotelPlaceIdToName.has(r.place_id)) ? hotelPlaceIdToName.get(r.place_id)! : r.name
    if (!friendHotelDetails.has(key)) friendHotelDetails.set(key, [])
    friendHotelDetails.get(key)!.push({ friendName: r.friend_name, rating: r.rating, itineraryId: r.itinerary_id })
  }
  const friendFoodDetails = new Map<string, { friendName: string; rating: number | null; itineraryId: string }[]>()
  for (const r of friendFoodRows) {
    const key = (r.place_id && foodPlaceIdToName.has(r.place_id)) ? foodPlaceIdToName.get(r.place_id)! : r.name
    if (!friendFoodDetails.has(key)) friendFoodDetails.set(key, [])
    friendFoodDetails.get(key)!.push({ friendName: r.friend_name, rating: r.rating, itineraryId: r.itinerary_id })
  }
  const friendActivityDetails = new Map<string, { friendName: string; rating: number | null; itineraryId: string }[]>()
  for (const r of friendActivityRows) {
    const key = (r.place_id && activityPlaceIdToName.has(r.place_id)) ? activityPlaceIdToName.get(r.place_id)! : r.name
    if (!friendActivityDetails.has(key)) friendActivityDetails.set(key, [])
    friendActivityDetails.get(key)!.push({ friendName: r.friend_name, rating: r.rating, itineraryId: r.itinerary_id })
  }

  const placeRatings = new Map(placeAvgRows.map(row => [row.item_id, {
    avg: row.avg_rating == null ? null : Number(row.avg_rating),
    total: Number(row.total),
  }]))

  // friends who saved this itinerary
  const itineraryFriendBucketers = itineraryBucketersRows.map(r => r.friend_name)

  const displayTags = it.tags

  // Build map pins from geocoded items
  const mapPins: ItemPin[] = it.destinations.flatMap(d => {
    const zeroBased = d.items.some(item => item.type !== 'hotel' && item.dayIndex === 0)
    return d.items
      .filter(i => i.lat != null && i.lng != null)
      .map(i => ({
        id: i.id,
        name: i.name,
        type: i.type as 'hotel' | 'food_drink' | 'activity',
        lat: i.lat!,
        lng: i.lng!,
        day: isGuide || i.type === 'hotel' ? null : mapDayNumber(i.dayIndex, zeroBased),
        recommendation: getRecommendation(i.tags),
      }))
  })

  function fmtShort(d: Date) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const days =
    Math.ceil((new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / 86400000) + 1

  const placeDestinations = new Map(it.destinations.flatMap(destination =>
    destination.items.map(item => [item.id, [destination.name, destination.country].filter(Boolean).join(', ')] as const)
  ))

  const stamp = it.tripRating ? TRIP_STAMPS.find(s => s.value === it.tripRating) : null

  // Use the same paper cards throughout highlights, daily plans, and guides.
  const renderPlaceCard = (item: DestItemRow, type: PlaceCategory, compact = false) => {
    const { eyebrow, Icon } = PLACE_CATEGORIES[type]
    const recommendation = getRecommendation(item.tags)
    const tilePhoto = pickEventPhoto(eventPhotos(item.photoUrls, item.photoUrl))
    const nameKey = item.name.toLowerCase()
    const friends = (type === 'hotel' ? friendHotelDetails : type === 'food_drink' ? friendFoodDetails : friendActivityDetails).get(nameKey) ?? []
    const { avg = null, total = 0 } = placeRatings.get(item.id) ?? {}
    const label = type === 'food_drink' && item.mealType
      ? item.mealType.split(',').map(meal => meal.trim()).filter(Boolean).join(' · ')
      : eyebrow
    const price = item.priceLevel == null ? null : Math.max(0, Math.min(type === 'hotel' ? 5 : 4, item.priceLevel))

    return (
      <PlaceDetailsCard key={item.id} place={item} destination={placeDestinations.get(item.id) ?? ''} category={PLACE_CATEGORIES[type].label} recommendation={recommendation} isHotel={type === 'hotel'} className={`${styles.card} ${styles[type]} ${recommendation !== 'none' ? styles.stamped : ''}`}>
        {recommendation === 'must' && type !== 'hotel' && <Image src="/must-do-stamp.png" alt="Must do" width={60} height={54} unoptimized className={styles.mustDoStamp} />}
        {recommendation === 'must' && type === 'hotel' && <span className={`${styles.mustDoStamp} ${styles.textStamp}`}><BedDouble size={24} aria-hidden="true" /><span>Must stay</span></span>}
        {recommendation === 'avoid' && <span className={`${styles.mustDoStamp} ${styles.textStamp} ${styles.avoidStamp}`}><Ban size={24} aria-hidden="true" /><span>Avoid</span></span>}
        <div className={styles.thumbnail}>
          {tilePhoto ? (
            <Image src={tilePhoto} alt="" fill sizes="88px" className="object-cover" />
          ) : (
            <div className={styles.keepsake} aria-hidden="true">
              <span>{eyebrow}</span>
              <Icon size={25} strokeWidth={1} />
              <span>{item.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span>
            </div>
          )}
        </div>
        <div className={styles.cardBody}>
          <p className={styles.eyebrow}>{label}</p>
          <h4 className={styles.placeName}>{item.name}</h4>
          {(!!item.rating || (!compact && price !== null && price > 0)) && (
            <div className={styles.meta}>
              {!!item.rating && <span className={styles.rating} aria-label={`Trip author rated ${item.rating} out of 5 stars`}><Star size={12} aria-hidden="true" />{item.rating.toFixed(1)} <span className={styles.ratingLabel}>Author</span></span>}
              {!compact && price !== null && price > 0 && <span className={styles.price}>{'$'.repeat(price)}</span>}
            </div>
          )}
          {!compact && item.notes && <p className={styles.note}>{item.notes}</p>}
          {recommendation === 'must' && <p className={styles.recommendation}><Check size={12} /> {type === 'hotel' ? 'Must stay' : 'Trip highlight'}</p>}
          <FriendProof friends={friends} avg={avg} total={total} verb={type === 'hotel' ? 'stayed here' : type === 'activity' ? 'also did this' : 'also went'} />
        </div>
      </PlaceDetailsCard>
    )
  }

  const renderHotelCard = (item: DestItemRow, compact = false) => renderPlaceCard(item, 'hotel', compact)
  const renderFoodCard = (item: DestItemRow, compact = false) => renderPlaceCard(item, 'food_drink', compact)
  const renderActivityCard = (item: DestItemRow, compact = false) => renderPlaceCard(item, 'activity', compact)

  return (
    <div className="min-h-screen bg-[#F0E8D9]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-[#8B6F4E] hover:underline mb-6 inline-block">← Back to feed</Link>

        {it.visibility === 'draft' && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
            Draft — only visible to you. <Link href={`/itinerary/${it.id}/edit`} className="underline">Edit &amp; publish</Link>
          </div>
        )}

        {/* ── Editorial Header ── */}
        <div className="mb-7">
          {/* Location / type row */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
            {it.destinations.map((d, i) => (
              <span key={i} className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold">
                {d.name}{d.country ? `, ${d.country}` : ''}
              </span>
            ))}
            {isGuide && <span className="text-xs uppercase tracking-widest text-green-700 font-semibold">· Guide</span>}
          </div>

          {/* Serif title */}
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-[#2C1810] leading-tight mb-3">
            {it.title}
          </h1>

          {/* Italic description */}
          {it.description && (
            <p className="font-[family-name:var(--font-playfair)] italic text-[#5C3D2E] text-lg mb-3">
              {it.description}
            </p>
          )}

          {/* Author / meta / actions row */}
          <div className="flex items-center justify-between flex-wrap gap-3 border-t border-b border-[#C4A882] py-3 mb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/user/${it.user.id}`} className="flex items-center gap-2 hover:opacity-80">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {it.user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-[#2C1810]">{it.user.name}</span>
              </Link>
              {!isGuide && (
                <span className="text-xs text-[#8B6F4E]">
                  {fmtShort(it.startDate)} – {fmtShort(it.endDate)} · {days} days
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {stamp && (
                <span className={`-rotate-2 inline-block text-xs px-3 py-1 rounded-full font-bold text-white ${stamp.bg}`}>
                  {stamp.label}
                </span>
              )}
              {!isOwn && (
                <BucketButton itineraryId={it.id} initialBucketed={isBucketed} isLoggedIn={!!session?.user} size="md" />
              )}
              {isOwn && (
                <div className="flex items-center gap-2">
                  <Link href={`/itinerary/${it.id}/edit`}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-[#C4A882] text-[#5C3D2E] hover:bg-[#E8D5B7] transition-colors">
                    Edit
                  </Link>
                  <DeleteButton id={it.id} />
                </div>
              )}
              {session?.user && !isOwn && (
                <form action={async () => {
                  'use server'
                  if (followStatus === 'accepted') await unfollowUser(it.user.id)
                  else if (followStatus === 'pending') await cancelFollowRequest(it.user.id)
                  else await sendFollowRequest(it.user.id)
                }}>
                  <button type="submit" className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    followStatus === 'accepted'
                      ? 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500'
                      : followStatus === 'pending'
                      ? 'border-amber-300 text-amber-700 hover:border-red-300 hover:text-red-500'
                      : 'bg-[#2C1810] border-[#2C1810] text-white hover:bg-[#5C3D2E]'
                  }`}>
                    {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : '+ Follow'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {it.notes && (
            <section className="mb-5 border-l-2 border-[#C4A882] pl-4">
              <h2 className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-2">Notes &amp; Tips</h2>
              <p className="text-sm leading-relaxed text-[#5C3D2E] whitespace-pre-line break-words">{it.notes}</p>
            </section>
          )}

          {/* Tags + social meta */}
          <div className="flex flex-wrap gap-2 items-center">
            {!isGuide && it.audience === 'family' && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-800">Family Friendly</span>
            )}
            {displayTags.map(tag => {
              const meta = tagMeta(tag)
              return meta ? (
                <span key={tag} className="inline-flex items-center gap-1 text-xs bg-[#E8D5B7] text-[#5C3D2E] px-2.5 py-1 rounded-full font-medium">
                  {meta.emoji} {meta.label}
                </span>
              ) : null
            })}
            {it.bestMonths && it.bestMonths.length > 0 && it.bestMonths.map(m => (
              <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">{m}</span>
            ))}
            {itineraryFriendBucketers.length > 0 && (
              <span className="text-xs text-[#8B6F4E]">
                🔖 <span className="font-medium text-[#5C3D2E]">
                  {itineraryFriendBucketers.slice(0, 3).map(n => n.split(' ')[0]).join(', ')}
                </span>
                {itineraryFriendBucketers.length > 3 && ` +${itineraryFriendBucketers.length - 3} more`} saved this
              </span>
            )}
          </div>
        </div>

        {/* Photo strip */}
        {(() => {
          const userPhotos = tripPhotoGallery(it.photos, it.destinations.flatMap(d => d.items))
          const stockPhoto = it.photos.find(p => p.isStock)
          if (userPhotos.length > 0) return (
            <div className="mb-7 rounded-2xl overflow-hidden">
              <PhotoStrip photos={userPhotos} title={it.title} />
            </div>
          )
          if (stockPhoto) return (
            <div className="relative h-64 w-full rounded-2xl overflow-hidden mb-7">
              <Image src={stockPhoto.url} alt={it.title} fill className="object-cover" priority />
            </div>
          )
          return null
        })()}

        <nav aria-label="Itinerary view" className="flex flex-wrap gap-1 bg-[#E8D5B7] rounded-xl p-1 text-sm font-medium mb-6 w-fit">
          <Link href={`/itinerary/${it.id}`} aria-current={!showMap && !showDayByDay ? 'page' : undefined}
            className={`px-4 py-2 rounded-lg transition-colors ${!showMap && !showDayByDay ? 'bg-[#FAF7F2] shadow-sm text-[#2C1810]' : 'text-[#8B6F4E] hover:text-[#5C3D2E]'}`}>
            All places
          </Link>
          {hasDailyPlan && <Link href={`/itinerary/${it.id}?view=day-by-day`} aria-current={showDayByDay ? 'page' : undefined}
            className={`px-4 py-2 rounded-lg transition-colors ${showDayByDay ? 'bg-[#FAF7F2] shadow-sm text-[#2C1810]' : 'text-[#8B6F4E] hover:text-[#5C3D2E]'}`}>
            Day by day view
          </Link>}
          {mapPins.length > 0 && <Link href={`/itinerary/${it.id}?view=map`} aria-current={showMap ? 'page' : undefined}
            className={`px-4 py-2 rounded-lg transition-colors ${showMap ? 'bg-[#FAF7F2] shadow-sm text-[#2C1810]' : 'text-[#8B6F4E] hover:text-[#5C3D2E]'}`}>
            Map
          </Link>}
        </nav>

        {showMap && (
          <div className="h-[60vh] rounded-2xl overflow-hidden border border-[#C4A882] mb-6">
            <ItineraryMap pins={mapPins} />
          </div>
        )}

        {!showMap && (
          <>
            {/* ── Day by Day (itineraries) ── */}
            {showDayByDay && it.destinations.length > 0 && (
              <div className="mb-10">
                <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-1">Day by Day</h2>
                <div className="h-px bg-[#C4A882] mb-5" />
                <div className="space-y-10">
                  {it.destinations.map((dest) => {
                    const groups = groupItems(dest.items as DestItemRow[])
                    const multiStay = groups.length > 1
                    const dayOffset = dest.items.some(item => item.type !== 'hotel' && item.dayIndex === 0) ? 1 : 0
                    const dayNumber = (day: number) => Math.max(1, day + dayOffset)
                    const dFriends = friendDestNames.get(dest.name.toLowerCase()) ?? []
                    const dSaved = savedDestMap.get(dest.name.toLowerCase()) ?? 0
                    return (
                      <div key={dest.id}>
                        {it.destinations.length > 1 && (
                          <p className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-2 flex items-center gap-1">
                            <MapPin size={11} /> {dest.name}{dest.country ? `, ${dest.country}` : ''}
                          </p>
                        )}
                        {(dFriends.length > 0 || dSaved > 0) && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs text-[#8B6F4E]">
                            {dFriends.length > 0 && (
                              <span>👫 <span className="font-medium text-[#5C3D2E]">{dFriends.slice(0, 3).map(n => n.split(' ')[0]).join(', ')}</span>
                                {dFriends.length > 3 && ` +${dFriends.length - 3} more`} also visited
                              </span>
                            )}
                            {dSaved > 0 && <span>🔖 Saved by {dSaved} {dSaved === 1 ? 'traveler' : 'travelers'}</span>}
                          </div>
                        )}
                        {dest.notes && <p className="text-xs text-[#8B6F4E] italic mb-3 border-l-2 border-[#C4A882] pl-2">{dest.notes}</p>}
                        <div className="space-y-5">
                          {groups.map((group, gi) => {
                            if (multiStay) {
                              return (
                                <div key={gi} className="space-y-4">
                                  {group.days.map((day, di) => {
                                    const dn = dayNumber(day.dayIndex)
                                    return (
                                      <div key={di}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-xs font-bold text-[#FAF7F2] bg-[#2C1810] px-2.5 py-1 rounded-full">Day {dn}</span>
                                        </div>
                                        {di === 0 && group.hotel && renderHotelCard(group.hotel)}
                                        <div className="space-y-2 mt-2">
                                          {day.items.map(item => item.type === 'food_drink' ? renderFoodCard(item) : renderActivityCard(item))}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            } else {
                              return (
                                <div key={gi} className="space-y-3">
                                  {group.hotel && renderHotelCard(group.hotel)}
                                  {group.days.map((day, di) => (
                                    <div key={di}>
                                      {(group.days.length > 1 || dayNumber(day.dayIndex) > 1) && (
                                        <div className="flex items-center gap-2 mb-2 mt-2">
                                          <span className="text-xs font-bold text-[#FAF7F2] bg-[#2C1810] px-2.5 py-1 rounded-full">Day {dayNumber(day.dayIndex)}</span>
                                        </div>
                                      )}
                                      <div className="space-y-2">
                                        {day.items.map(item => item.type === 'food_drink' ? renderFoodCard(item) : renderActivityCard(item))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            }
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* All places grouped by category, for both itineraries and guides. */}
            {!showDayByDay && it.destinations.length > 0 && (
              <div className="mb-10">
                <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-1">Places from the trip</h2>
                <div className="h-px bg-[#C4A882] mb-5" />
                <div className="space-y-10">
                  {it.destinations.map((dest) => {
                    const dItems = dest.items as DestItemRow[]
                    const dHotels = dItems.filter(i => i.type === 'hotel')
                    const dFood = dItems.filter(i => i.type === 'food_drink')
                    const dActs = dItems.filter(i => i.type === 'activity')
                    return (
                      <div key={dest.id}>
                        {it.destinations.length > 1 && (
                          <p className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-3 flex items-center gap-1">
                            <MapPin size={11} /> {dest.name}{dest.country ? `, ${dest.country}` : ''}
                          </p>
                        )}
                        {dest.notes && <p className="text-xs text-[#8B6F4E] italic mb-3 border-l-2 border-[#C4A882] pl-2">{dest.notes}</p>}
                        <div className={styles.placeGrid}>
                          {dHotels.length > 0 && (
                            <div>
                              <CategoryHeading type="hotel" count={dHotels.length} />
                              <div className="space-y-2">{dHotels.map(item => renderHotelCard(item))}</div>
                            </div>
                          )}
                          {dFood.length > 0 && (
                            <div>
                              <CategoryHeading type="food_drink" count={dFood.length} />
                              <div className="space-y-2">{dFood.map(item => renderFoodCard(item))}</div>
                            </div>
                          )}
                          {dActs.length > 0 && (
                            <div>
                              <CategoryHeading type="activity" count={dActs.length} />
                              <div className="space-y-2">{dActs.map(item => renderActivityCard(item))}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <Comments
              itineraryId={it.id}
              initialComments={comments}
              currentUserId={session?.user?.id}
              isLoggedIn={!!session?.user}
            />
          </>
        )}
      </div>
    </div>
  )
}
