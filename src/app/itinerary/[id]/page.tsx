import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'
import { Hotel, Utensils, Camera, MapPin, Star, Check, ArrowUpRight } from 'lucide-react'
import BucketButton from '@/components/BucketButton'
import PhotoStrip from '@/components/PhotoStrip'
import { tagMeta } from '@/lib/tags'
import DeleteButton from '@/components/DeleteButton'
import Comments from '@/components/Comments'
import { TRIP_STAMPS } from '@/lib/tripStamps'
import ItineraryMap from '@/components/ItineraryMap'
import type { ItemPin } from '@/components/ItineraryMapInner'

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
  if (friends.length === 0 && avg === null) return null
  return (
    <div className="mt-1 space-y-0.5">
      {friends.length === 1 ? (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span>👫</span>
          <span className="font-medium">{friends[0].friendName.split(' ')[0]}</span>
          {friends[0].rating ? (
            <span className="text-yellow-500">
              {'★'.repeat(friends[0].rating)}
              <span className="text-gray-200">{'★'.repeat(5 - friends[0].rating)}</span>
            </span>
          ) : (
            <span className="text-gray-400">{verb}</span>
          )}
          <Link href={`/itinerary/${friends[0].itineraryId}`} className="text-blue-400 hover:underline text-[10px]">their trip</Link>
        </div>
      ) : friends.length > 1 ? (
        <details className="text-xs text-gray-600">
          <summary className="list-none cursor-pointer flex items-center gap-1.5">
            <span>👫</span>
            <span className="font-medium text-gray-700">{friends.length} friends {verb}</span>
          </summary>
          <div className="mt-1 space-y-0.5 pl-5">
            {friends.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="font-medium">{f.friendName.split(' ')[0]}</span>
                {f.rating ? (
                  <span className="text-yellow-500">
                    {'★'.repeat(f.rating)}
                    <span className="text-gray-200">{'★'.repeat(5 - f.rating)}</span>
                  </span>
                ) : (
                  <span className="text-gray-400">{verb}</span>
                )}
                <Link href={`/itinerary/${f.itineraryId}`} className="text-blue-400 hover:underline">their trip</Link>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {avg !== null && total > 1 && (
        <p className="text-xs text-gray-400 mt-0.5">★ {avg.toFixed(1)} avg · {total} ratings</p>
      )}
    </div>
  )
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={12}
          className={s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
      ))}
    </span>
  )
}

type DestItemRow = { id: string; type: string; mealType?: string | null; name: string; description?: string | null; notes?: string | null; address?: string | null; rating?: number | null; priceLevel?: number | null; familyFriendly?: boolean | null; link?: string | null; groupIndex?: number; dayIndex?: number | null; tags?: string[]; alternative?: string | null; photoUrl?: string | null }

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

const MEAL_PILL_STYLES: Record<string, string> = {
  breakfast: 'bg-yellow-100 text-yellow-700',
  lunch: 'bg-orange-100 text-orange-700',
  dinner: 'bg-purple-100 text-purple-700',
  drinks: 'bg-blue-100 text-blue-700',
  coffee: 'bg-amber-100 text-amber-800',
  dessert: 'bg-pink-100 text-pink-700',
  bakery: 'bg-orange-50 text-orange-600',
}
const MEAL_EMOJIS: Record<string, string> = {
  breakfast: '🍳', lunch: '☀️', dinner: '🌙', drinks: '🍹', coffee: '☕', dessert: '🍰', bakery: '🥐',
}

function MealPills({ mealType }: { mealType: string | null | undefined }) {
  if (!mealType) return null
  return mealType.split(',').filter(Boolean).map((type) => (
    <span key={type} className={`text-xs px-2 py-0.5 rounded-full font-medium ${MEAL_PILL_STYLES[type] ?? 'bg-blue-100 text-blue-700'}`}>
      {MEAL_EMOJIS[type] ?? '🍽️'} {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  ))
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
  const showMap = view === 'map'
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
  type AvgRow = { name: string; total: bigint; avg_rating: number | null }
  type BucketerRow = { friend_name: string }

  const [friendDestRows, savedDestRows, friendHotelRows, friendFoodRows, friendActivityRows, hotelAvgRows, foodAvgRows, itineraryBucketersRows] = await Promise.all([
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
    // Community avg star rating for hotels
    hotelNamesLower.length > 0
      ? prisma.$queryRaw<AvgRow[]>(Prisma.sql`
          SELECT LOWER(di.name) AS name,
            COUNT(*) FILTER (WHERE di.rating IS NOT NULL) AS total,
            AVG(di.rating::float) FILTER (WHERE di.rating IS NOT NULL) AS avg_rating
          FROM "DestItem" di
          WHERE di.type = 'hotel'
            AND LOWER(di.name) IN (${Prisma.join(hotelNamesLower)})
          GROUP BY LOWER(di.name)
        `)
      : Promise.resolve([] as AvgRow[]),
    // Community avg star rating for food
    foodNamesLower.length > 0
      ? prisma.$queryRaw<AvgRow[]>(Prisma.sql`
          SELECT LOWER(di.name) AS name,
            COUNT(*) FILTER (WHERE di.rating IS NOT NULL) AS total,
            AVG(di.rating::float) FILTER (WHERE di.rating IS NOT NULL) AS avg_rating
          FROM "DestItem" di
          WHERE di.type = 'food_drink'
            AND LOWER(di.name) IN (${Prisma.join(foodNamesLower)})
          GROUP BY LOWER(di.name)
        `)
      : Promise.resolve([] as AvgRow[]),
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

  // community avg stars (1 decimal)
  const hotelAvgMap = new Map(hotelAvgRows.map(r => [
    r.name,
    r.avg_rating != null ? Math.round(Number(r.avg_rating) * 10) / 10 : null,
  ]))
  const foodAvgMap = new Map(foodAvgRows.map(r => [
    r.name,
    r.avg_rating != null ? Math.round(Number(r.avg_rating) * 10) / 10 : null,
  ]))
  const hotelTotalMap = new Map(hotelAvgRows.map(r => [r.name, Number(r.total)]))
  const foodTotalMap  = new Map(foodAvgRows.map(r => [r.name, Number(r.total)]))

  // friends who saved this itinerary
  const itineraryFriendBucketers = itineraryBucketersRows.map(r => r.friend_name)

  const displayTags = it.tags

  // Build map pins from geocoded items
  const mapPins: ItemPin[] = it.destinations.flatMap(d =>
    d.items
      .filter(i => i.lat != null && i.lng != null)
      .map(i => ({
        id: i.id,
        name: i.name,
        type: i.type as 'hotel' | 'food_drink' | 'activity',
        lat: i.lat!,
        lng: i.lng!,
      }))
  )

  function fmtShort(d: Date) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const days =
    Math.ceil((new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / 86400000) + 1

  // Must Dos: pick highlights or top-rated from all destinations
  const allItems = it.destinations.flatMap(d => d.items as DestItemRow[])
  function pickMustDos(items: DestItemRow[], max: number): DestItemRow[] {
    const tagged = items.filter(i => i.tags?.includes('__highlight'))
    if (tagged.length >= max) return tagged.slice(0, max)
    const rated = items
      .filter(i => !i.tags?.includes('__highlight') && (i.rating ?? 0) > 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    return [...tagged, ...rated].slice(0, max)
  }
  const mustHotels = allItems.filter(i => i.type === 'hotel').slice(0, 3)
  const mustFood = pickMustDos(allItems.filter(i => i.type === 'food_drink'), 4)
  const mustActivities = pickMustDos(allItems.filter(i => i.type === 'activity'), 4)
  const showMustDos = mustHotels.length > 0 || mustFood.length > 0 || mustActivities.length > 0
  const stamp = it.tripRating ? TRIP_STAMPS.find(s => s.value === it.tripRating) : null

  // Horizontal card renderers — compact=true for Must Dos (no notes/links)
  const renderHotelCard = (item: DestItemRow, compact = false) => (
    <div key={item.id} className="flex bg-[#FAF7F2] rounded-xl overflow-hidden border border-[#E8D5B7]">
      <div className="w-20 shrink-0 relative min-h-[80px] bg-[#E8D5B7] flex items-center justify-center">
        {item.photoUrl
          ? <Image src={item.photoUrl} alt={item.name} fill className="object-cover" />
          : <Hotel size={22} className="text-[#8B6F4E]" />}
      </div>
      <div className="flex-1 py-2.5 px-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-[#2C1810] leading-tight">{item.name}</p>
          {item.rating && <Stars rating={item.rating} />}
        </div>
        {!compact && item.priceLevel != null && (
          <p className="text-xs font-medium text-green-700 mt-0.5">
            {'$'.repeat(item.priceLevel)}<span className="text-[#C4A882]">{'$'.repeat(5 - item.priceLevel)}</span>
          </p>
        )}
        {!compact && item.notes && <p className="text-xs text-[#8B6F4E] italic mt-0.5 line-clamp-2">{item.notes}</p>}
        <FriendProof
          friends={friendHotelDetails.get(item.name.toLowerCase()) ?? []}
          avg={hotelAvgMap.get(item.name.toLowerCase()) ?? null}
          total={hotelTotalMap.get(item.name.toLowerCase()) ?? 0}
          verb="stayed here"
        />
        {!compact && item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline mt-0.5 inline-flex items-center gap-0.5">
            <ArrowUpRight size={10} /> Official site
          </a>
        )}
      </div>
    </div>
  )

  const renderFoodCard = (item: DestItemRow, compact = false) => (
    <div key={item.id} className="flex bg-[#FAF7F2] rounded-xl overflow-hidden border border-[#E8D5B7]">
      <div className="w-20 shrink-0 relative min-h-[80px] bg-[#EDE0CC] flex items-center justify-center">
        {item.photoUrl
          ? <Image src={item.photoUrl} alt={item.name} fill className="object-cover" />
          : <Utensils size={22} className="text-[#8B6F4E]" />}
      </div>
      <div className="flex-1 py-2.5 px-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-[#2C1810] leading-tight">{item.name}</p>
          {item.rating && <Stars rating={item.rating} />}
        </div>
        {item.mealType && <div className="flex gap-1 mt-0.5 flex-wrap"><MealPills mealType={item.mealType} /></div>}
        {!compact && item.priceLevel != null && (
          <p className="text-xs font-medium text-green-700 mt-0.5">
            {'$'.repeat(item.priceLevel)}<span className="text-[#C4A882]">{'$'.repeat(4 - item.priceLevel)}</span>
          </p>
        )}
        {!compact && item.notes && <p className="text-xs text-[#8B6F4E] italic mt-0.5 line-clamp-2">{item.notes}</p>}
        <FriendProof
          friends={friendFoodDetails.get(item.name.toLowerCase()) ?? []}
          avg={foodAvgMap.get(item.name.toLowerCase()) ?? null}
          total={foodTotalMap.get(item.name.toLowerCase()) ?? 0}
          verb="also went"
        />
        {!compact && item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline mt-0.5 inline-flex items-center gap-0.5">
            <ArrowUpRight size={10} /> Official site
          </a>
        )}
      </div>
    </div>
  )

  const renderActivityCard = (item: DestItemRow, compact = false) => (
    <div key={item.id} className="flex bg-[#FAF7F2] rounded-xl overflow-hidden border border-[#E8D5B7]">
      <div className="w-20 shrink-0 relative min-h-[80px] bg-[#DDE8D5] flex items-center justify-center">
        {item.photoUrl
          ? <Image src={item.photoUrl} alt={item.name} fill className="object-cover" />
          : <Camera size={22} className="text-[#4E6B4E]" />}
      </div>
      <div className="flex-1 py-2.5 px-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-[#2C1810] leading-tight">{item.name}</p>
          {item.rating && <Stars rating={item.rating} />}
        </div>
        {!compact && item.notes && <p className="text-xs text-[#8B6F4E] italic mt-0.5 line-clamp-2">{item.notes}</p>}
        <FriendProof
          friends={friendActivityDetails.get(item.name.toLowerCase()) ?? []}
          avg={null}
          total={0}
          verb="also did this"
        />
        {!compact && item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline mt-0.5 inline-flex items-center gap-0.5">
            <ArrowUpRight size={10} /> Official site
          </a>
        )}
      </div>
    </div>
  )

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
              {session?.user && !isOwn && (
                <BucketButton itineraryId={it.id} initialBucketed={isBucketed} isLoggedIn={true} size="md" />
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
          const userPhotos = it.photos.filter(p => !p.isStock)
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

        {/* Map toggle */}
        {mapPins.length > 0 && (
          <div className="flex gap-1 bg-[#E8D5B7] rounded-xl p-1 text-sm font-medium mb-6 w-fit">
            <Link href={`/itinerary/${it.id}`}
              className={`px-4 py-1.5 rounded-lg transition-colors ${!showMap ? 'bg-[#FAF7F2] shadow-sm text-[#2C1810]' : 'text-[#8B6F4E] hover:text-[#5C3D2E]'}`}>
              Details
            </Link>
            <Link href={`/itinerary/${it.id}?view=map`}
              className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${showMap ? 'bg-[#FAF7F2] shadow-sm text-[#2C1810]' : 'text-[#8B6F4E] hover:text-[#5C3D2E]'}`}>
              🗺️ Map
            </Link>
          </div>
        )}

        {showMap && (
          <div className="h-[60vh] rounded-2xl overflow-hidden border border-[#C4A882] mb-6">
            <ItineraryMap pins={mapPins} />
          </div>
        )}

        {!showMap && (
          <>
            {/* ── Must Dos ── */}
            {showMustDos && (
              <div className="mb-10">
                <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-1">Must Dos</h2>
                <div className="h-px bg-[#C4A882] mb-5" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {mustHotels.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-3 flex items-center gap-1.5">
                        <Hotel size={11} /> Hotels
                      </p>
                      <div className="space-y-2">{mustHotels.map(item => renderHotelCard(item, true))}</div>
                    </div>
                  )}
                  {mustFood.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-3 flex items-center gap-1.5">
                        <Utensils size={11} /> Restaurants
                      </p>
                      <div className="space-y-2">{mustFood.map(item => renderFoodCard(item, true))}</div>
                    </div>
                  )}
                  {mustActivities.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-3 flex items-center gap-1.5">
                        <Camera size={11} /> Activities
                      </p>
                      <div className="space-y-2">{mustActivities.map(item => renderActivityCard(item, true))}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Day by Day (itineraries) ── */}
            {!isGuide && it.destinations.length > 0 && (
              <div className="mb-10">
                <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-1">Day by Day</h2>
                <div className="h-px bg-[#C4A882] mb-5" />
                <div className="space-y-10">
                  {it.destinations.map((dest) => {
                    const groups = groupItems(dest.items as DestItemRow[])
                    const multiStay = groups.length > 1
                    let dayCounter = 0
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
                                    dayCounter++
                                    const dn = dayCounter
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
                                      {group.days.length > 1 && (
                                        <div className="flex items-center gap-2 mb-2 mt-2">
                                          <span className="text-xs font-bold text-[#FAF7F2] bg-[#2C1810] px-2.5 py-1 rounded-full">Day {di + 1}</span>
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

            {/* ── Guide: All Picks (three-column per destination) ── */}
            {isGuide && it.destinations.length > 0 && (
              <div className="mb-10">
                <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-1">All Picks</h2>
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {dHotels.length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-2 flex items-center gap-1.5"><Hotel size={11} /> Hotels</p>
                              <div className="space-y-2">{dHotels.map(item => renderHotelCard(item))}</div>
                            </div>
                          )}
                          {dFood.length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-2 flex items-center gap-1.5"><Utensils size={11} /> Restaurants</p>
                              <div className="space-y-2">{dFood.map(item => renderFoodCard(item))}</div>
                            </div>
                          )}
                          {dActs.length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-widest text-[#8B6F4E] font-semibold mb-2 flex items-center gap-1.5"><Camera size={11} /> Activities</p>
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

            {/* Notes & Tips */}
            {it.notes && (
              <div className="mb-8">
                <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-1">Notes & Tips</h2>
                <div className="h-px bg-[#C4A882] mb-4" />
                <div className="bg-[#FAF7F2] border border-[#E8D5B7] rounded-2xl p-4 text-sm text-[#2C1810] whitespace-pre-line">
                  {it.notes}
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
