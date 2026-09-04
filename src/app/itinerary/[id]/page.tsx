import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'
import { Hotel, Utensils, Camera, MapPin, Star } from 'lucide-react'
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

type HighlightGroup = { dest: string; items: { type: string; name: string }[] }

function getHighlightGroups(
  destinations: { name: string; country: string | null; items: { id: string; type: string; name: string; rating: number | null; tags: string[] }[] }[]
): HighlightGroup[] {
  const sortByRating = (a: { id: string; rating: number | null }, b: { id: string; rating: number | null }) => {
    const diff = (b.rating ?? 0) - (a.rating ?? 0)
    return diff !== 0 ? diff : a.id < b.id ? -1 : 1 // stable tiebreaker via id
  }

  return destinations
    .map(dest => {
      const eligible = dest.items.filter(i => i.type !== 'hotel' && i.name.trim())
      const picked = eligible.filter(i => i.tags.includes('__highlight'))
      let items: { type: string; name: string }[]

      if (picked.length > 0) {
        const pickedFood = picked.filter(i => i.type === 'food_drink').slice(0, 1)
        const pickedAct  = picked.filter(i => i.type === 'activity').slice(0, 1)
        items = [...pickedFood, ...pickedAct].map(i => ({ type: i.type, name: i.name }))
      } else {
        const food = eligible.filter(i => i.type === 'food_drink' && (i.rating ?? 0) > 0).sort(sortByRating).slice(0, 1)
        const acts = eligible.filter(i => i.type === 'activity' && (i.rating ?? 0) > 0).sort(sortByRating).slice(0, 1)
        items = [...food, ...acts].map(i => ({ type: i.type, name: i.name }))
      }

      const label = [dest.name, dest.country].filter(Boolean).join(', ')
      return { dest: label, items }
    })
    .filter(g => g.items.length > 0)
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

  // placeId → canonical name (from this itinerary) for placeId-based matching
  const hotelPlaceIdToName = new Map<string, string>()
  const foodPlaceIdToName = new Map<string, string>()
  for (const d of it.destinations) {
    for (const item of d.items) {
      if (item.placeId) {
        if (item.type === 'hotel') hotelPlaceIdToName.set(item.placeId, item.name.toLowerCase())
        if (item.type === 'food_drink') foodPlaceIdToName.set(item.placeId, item.name.toLowerCase())
      }
    }
  }
  const hotelPlaceIds = [...hotelPlaceIdToName.keys()]
  const foodPlaceIds = [...foodPlaceIdToName.keys()]

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

  const [friendDestRows, savedDestRows, friendHotelRows, friendFoodRows, hotelAvgRows, foodAvgRows, itineraryBucketersRows] = await Promise.all([
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
  const autoTagged = false

  const highlightGroups = getHighlightGroups(it.destinations)

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Back to feed</Link>
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Photo strip — user photos scroll horizontally; stock photo as fallback cover */}
        {(() => {
          const userPhotos = it.photos.filter(p => !p.isStock)
          const stockPhoto = it.photos.find(p => p.isStock)
          if (userPhotos.length > 0) {
            return <PhotoStrip photos={userPhotos} title={it.title} />
          }
          if (stockPhoto) {
            return (
              <div className="relative h-64 w-full bg-gray-100">
                <Image src={stockPhoto.url} alt={it.title} fill className="object-cover" priority />
              </div>
            )
          }
          return null
        })()}

        {it.visibility === 'draft' && (
          <div className="px-5 pt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
              Draft — only visible to you. <Link href={`/itinerary/${it.id}/edit`} className="underline">Edit &amp; publish</Link>
            </div>
          </div>
        )}
        <div className="p-5">
          {/* Header: author + follow */}
          <div className="flex items-center justify-between mb-4">
            <Link href={`/user/${it.user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                {it.user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{it.user.name}</p>
                {!isGuide && (
                <p className="text-xs text-gray-500">
                  📅 {fmtShort(it.startDate)} – {fmtShort(it.endDate)} · {days} days
                </p>
              )}
              </div>
            </Link>
            <div className="flex gap-2 items-center">
              {session?.user && !isOwn && (
                <BucketButton
                  itineraryId={it.id}
                  initialBucketed={isBucketed}
                  isLoggedIn={true}
                  size="md"
                />
              )}
              {isOwn && (
                <div className="flex items-center gap-2">
                  <Link href={`/itinerary/${it.id}/edit`}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
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
                  <button type="submit"
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                      followStatus === 'accepted'
                        ? 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500'
                        : followStatus === 'pending'
                        ? 'border-amber-300 text-amber-700 hover:border-red-300 hover:text-red-500'
                        : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                    }`}>
                    {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : '+ Follow'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Friends who saved this itinerary */}
          {itineraryFriendBucketers.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-500">
              <span>🔖</span>
              <span>
                <span className="font-medium text-gray-700">
                  {itineraryFriendBucketers.slice(0, 3).map(n => n.split(' ')[0]).join(', ')}
                </span>
                {itineraryFriendBucketers.length > 3 && ` +${itineraryFriendBucketers.length - 3} more`}
                {' '}saved this
              </span>
            </div>
          )}

          {/* Title & destination chips */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {isGuide && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-800">
                  📖 Guide
                </span>
              )}
              {it.destinations.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  <MapPin size={10} />
                  {d.name}{d.country ? `, ${d.country}` : ''}
                </span>
              ))}
              {!isGuide && it.audience === 'family' && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-800">
                  Family Friendly
                </span>
              )}
              {it.tripRating && (() => {
                const stamp = TRIP_STAMPS.find(s => s.value === it.tripRating)
                return stamp ? (
                  <span className={`-rotate-2 inline-block text-xs px-3 py-1 rounded-full font-bold text-white ${stamp.bg}`}>
                    {stamp.label}
                  </span>
                ) : null
              })()}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{it.title}</h1>
            {displayTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                {displayTags.map((tag) => {
                  const meta = tagMeta(tag)
                  return meta ? (
                    <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                      {meta.emoji} {meta.label}
                    </span>
                  ) : null
                })}
                {autoTagged && (
                  <span className="text-[10px] text-gray-400 italic">✨ auto-tagged</span>
                )}
              </div>
            )}
            {it.description && (
              <p className="text-gray-600 mt-2 text-sm italic border-l-4 border-blue-200 pl-3">
                &ldquo;{it.description}&rdquo;
              </p>
            )}
            {it.bestMonths && it.bestMonths.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <span className="text-xs text-gray-500 font-medium">🗓 Best time to go:</span>
                {it.bestMonths.map(m => (
                  <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">{m}</span>
                ))}
              </div>
            )}
          </div>

          {/* Highlights */}
          {highlightGroups.length > 0 && (
            <div className="mb-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-base">⭐</span>
                <h2 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Must Do</h2>
              </div>
              <div className="space-y-3">
                {highlightGroups.map((group, gi) => (
                  <div key={gi}>
                    {highlightGroups.length > 1 && (
                      <p className="text-xs font-semibold text-amber-700 mb-1.5">{group.dest}</p>
                    )}
                    <ul className="space-y-1.5">
                      {group.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="shrink-0">{item.type === 'food_drink' ? '🍽️' : '📍'}</span>
                          <span>{item.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details / Map toggle */}
          {mapPins.length > 0 && (
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium mb-4 w-fit">
              <Link
                href={`/itinerary/${it.id}`}
                className={`px-4 py-1.5 rounded-lg transition-colors ${!showMap ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Details
              </Link>
              <Link
                href={`/itinerary/${it.id}?view=map`}
                className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${showMap ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                🗺️ Map
              </Link>
            </div>
          )}

          {showMap ? (
            <div className="h-[60vh] rounded-xl overflow-hidden border border-gray-200 mb-5">
              <ItineraryMap pins={mapPins} />
            </div>
          ) : null}

          {/* Destinations */}
          {!showMap && it.destinations.length > 0 && (
            <div className="space-y-5 mb-5">
              {it.destinations.map((dest) => {
                const groups = groupItems(dest.items as DestItemRow[])
                const multiStay = groups.length > 1
                return (
                  <div key={dest.id}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <MapPin size={14} className="text-blue-600" />
                      {dest.name}{dest.country ? `, ${dest.country}` : ''}
                    </h3>
                    {(() => {
                      const key = dest.name.toLowerCase()
                      const names = friendDestNames.get(key) ?? []
                      const saved = savedDestMap.get(key) ?? 0
                      if (names.length === 0 && saved === 0) return null
                      return (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                          {names.length > 0 && (
                            <span className="text-xs text-gray-500">
                              👫 <span className="font-medium text-gray-700">{names.slice(0, 3).map(n => n.split(' ')[0]).join(', ')}</span>
                              {names.length > 3 && ` +${names.length - 3} more`} also visited
                            </span>
                          )}
                          {saved > 0 && (
                            <span className="text-xs text-gray-400">🔖 Saved by {saved} {saved === 1 ? 'traveler' : 'travelers'}</span>
                          )}
                        </div>
                      )
                    })()}
                    {dest.notes && (
                      <p className="text-xs text-gray-500 italic mb-3 border-l-2 border-blue-200 pl-2">{dest.notes}</p>
                    )}
                    <div className="space-y-3">
                      {isGuide ? (() => {
                        // Guide: group all items by type — hotels, then food, then activities
                        const allItems = dest.items as DestItemRow[]
                        const hotels = allItems.filter(i => i.type === 'hotel')
                        const food   = allItems.filter(i => i.type === 'food_drink')
                        const acts   = allItems.filter(i => i.type === 'activity')
                        const renderFoodItem = (item: DestItemRow) => (
                          <div key={item.id} className="bg-orange-50 rounded-lg overflow-hidden">
                            {item.photoUrl && (
                              <div className="w-full h-36 relative">
                                <Image src={item.photoUrl} alt={item.name} fill className="object-cover" />
                              </div>
                            )}
                            <div className="p-3">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Utensils size={12} className="text-orange-500 shrink-0" />
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                  <MealPills mealType={item.mealType} />
                                </div>
                              </div>
                              {(item.priceLevel != null || item.familyFriendly) && (
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {item.priceLevel != null && (
                                    <p className="text-xs font-medium text-green-700">
                                      {'$'.repeat(item.priceLevel)}<span className="text-gray-300">{'$'.repeat(4 - item.priceLevel)}</span>
                                    </p>
                                  )}
                                  {item.familyFriendly && (
                                    <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">👨‍👩‍👧 Family friendly</span>
                                  )}
                                </div>
                              )}
                              {item.description && <p className="text-xs text-gray-600 mt-1"><span className="font-semibold text-gray-500">Description: </span>{item.description}</p>}
                              {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                              {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                              <FriendProof
                                friends={friendFoodDetails.get(item.name.toLowerCase()) ?? []}
                                avg={foodAvgMap.get(item.name.toLowerCase()) ?? null}
                                total={foodTotalMap.get(item.name.toLowerCase()) ?? 0}
                                verb="also went"
                              />
                              {item.alternative && <p className="text-xs text-gray-400 mt-0.5">↔ Alternative: <span className="font-medium text-gray-500">{item.alternative}</span></p>}
                            </div>
                          </div>
                        )
                        const renderActivityItem = (item: DestItemRow) => (
                          <div key={item.id} className="bg-green-50 rounded-lg overflow-hidden">
                            {item.photoUrl && (
                              <div className="w-full h-36 relative">
                                <Image src={item.photoUrl} alt={item.name} fill className="object-cover" />
                              </div>
                            )}
                            <div className="p-3">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Camera size={12} className="text-green-600 shrink-0" />
                                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              </div>
                              {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                              {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                              {item.alternative && <p className="text-xs text-gray-400 mt-0.5">↔ Alternative: <span className="font-medium text-gray-500">{item.alternative}</span></p>}
                            </div>
                          </div>
                        )
                        return (
                          <>
                            {hotels.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 pt-1">
                                  <Hotel size={12} className="text-blue-500" /> Where to Stay
                                </p>
                                {hotels.map(hotel => (
                                  <div key={hotel.id} className="bg-blue-50 rounded-lg overflow-hidden">
                                    {hotel.photoUrl && (
                                      <div className="w-full h-36 relative">
                                        <Image src={hotel.photoUrl} alt={hotel.name} fill className="object-cover" />
                                      </div>
                                    )}
                                    <div className="p-3">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-gray-900">{hotel.name}</span>
                                      </div>
                                      <FriendProof
                                        friends={friendHotelDetails.get(hotel.name.toLowerCase()) ?? []}
                                        avg={hotelAvgMap.get(hotel.name.toLowerCase()) ?? null}
                                        total={hotelTotalMap.get(hotel.name.toLowerCase()) ?? 0}
                                        verb="stayed here"
                                      />
                                      {hotel.priceLevel != null && (
                                        <p className="text-xs font-medium text-green-700 mt-0.5">
                                          {'$'.repeat(hotel.priceLevel)}<span className="text-gray-300">{'$'.repeat(5 - hotel.priceLevel)}</span>
                                        </p>
                                      )}
                                      {hotel.description && <p className="text-xs text-gray-600 mt-1"><span className="font-semibold text-gray-500">Description: </span>{hotel.description}</p>}
                                      {hotel.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{hotel.notes}</p>}
                                      {hotel.address && <p className="text-xs text-gray-500 mt-0.5">📍 {hotel.address}</p>}
                                      {hotel.link && <a href={hotel.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                                      {hotel.alternative && <p className="text-xs text-gray-400 mt-0.5">↔ Stay here instead: <span className="font-medium text-gray-500">{hotel.alternative}</span></p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {food.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 pt-1">
                                  <Utensils size={12} className="text-orange-500" /> Food & Drink
                                </p>
                                {food.map(renderFoodItem)}
                              </div>
                            )}
                            {acts.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 pt-1">
                                  <Camera size={12} className="text-green-600" /> Things to Do
                                </p>
                                {acts.map(renderActivityItem)}
                              </div>
                            )}
                          </>
                        )
                      })() : (() => {
                        // Itinerary: day-based layout (unchanged)
                        let dayCounter = 0
                        const hotelCard = (hotel: (typeof groups)[0]['hotel']) => hotel && (
                          <div className="bg-blue-50 rounded-lg overflow-hidden">
                            {hotel.photoUrl && (
                              <div className="w-full h-36 relative">
                                <Image src={hotel.photoUrl} alt={hotel.name} fill className="object-cover" />
                              </div>
                            )}
                            <div className="p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Hotel size={14} className="text-blue-600" />
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lodging</p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">{hotel.name}</span>
                                <Stars rating={hotel.rating ?? null} />
                              </div>
                              <FriendProof
                                friends={friendHotelDetails.get(hotel.name.toLowerCase()) ?? []}
                                avg={hotelAvgMap.get(hotel.name.toLowerCase()) ?? null}
                                total={hotelTotalMap.get(hotel.name.toLowerCase()) ?? 0}
                                verb="stayed here"
                              />
                              {hotel.priceLevel != null && (
                                <p className="text-xs font-medium text-green-700 mt-0.5">
                                  {'$'.repeat(hotel.priceLevel)}
                                  <span className="text-gray-300">{'$'.repeat(5 - hotel.priceLevel)}</span>
                                </p>
                              )}
                              {hotel.description && <p className="text-xs text-gray-600 mt-1"><span className="font-semibold text-gray-500">Description: </span>{hotel.description}</p>}
                              {hotel.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{hotel.notes}</p>}
                              {hotel.address && <p className="text-xs text-gray-500 mt-0.5">📍 {hotel.address}</p>}
                              {hotel.link && <a href={hotel.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                              {hotel.alternative && <p className="text-xs text-gray-400 mt-0.5">↔ Stay here instead: <span className="font-medium text-gray-500">{hotel.alternative}</span></p>}
                            </div>
                          </div>
                        )
                        return groups.map((group, gi) => (
                          <div key={gi} className="space-y-2">
                            {multiStay ? (
                              <>
                                {group.days.map((day, di) => {
                                  dayCounter++
                                  const dn = dayCounter
                                  return (
                                    <div key={di} className="space-y-2">
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full shrink-0">Day {dn}</span>
                                      </div>
                                      {di === 0 && group.hotel && hotelCard(group.hotel)}
                                    {day.items.map(item => item.type === 'food_drink' ? (
                                    <div key={item.id} className="bg-orange-50 rounded-lg overflow-hidden">
                                      {item.photoUrl && <div className="w-full h-32 relative"><Image src={item.photoUrl} alt={item.name} fill className="object-cover" /></div>}
                                      <div className="p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Utensils size={12} className="text-orange-500 shrink-0" />
                                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                            <MealPills mealType={item.mealType} />
                                            <Stars rating={item.rating ?? null} />
                                          </div>
                                        </div>
                                        {(item.priceLevel != null || item.familyFriendly) && (
                                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {item.priceLevel != null && (
                                              <p className="text-xs font-medium text-green-700">
                                                {'$'.repeat(item.priceLevel)}<span className="text-gray-300">{'$'.repeat(4 - item.priceLevel)}</span>
                                              </p>
                                            )}
                                            {item.familyFriendly && (
                                              <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">👨‍👩‍👧 Family friendly</span>
                                            )}
                                          </div>
                                        )}
                                        {item.description && <p className="text-xs text-gray-600 mt-1"><span className="font-semibold text-gray-500">Description: </span>{item.description}</p>}
                                        {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                                        {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                                        <FriendProof
                                          friends={friendFoodDetails.get(item.name.toLowerCase()) ?? []}
                                          avg={foodAvgMap.get(item.name.toLowerCase()) ?? null}
                                          total={foodTotalMap.get(item.name.toLowerCase()) ?? 0}
                                          verb="also went"
                                        />
                                        {item.alternative && <p className="text-xs text-gray-400 mt-0.5">↔ Alternative: <span className="font-medium text-gray-500">{item.alternative}</span></p>}
                                      </div>
                                    </div>
                                  ) : (
                                    <div key={item.id} className="bg-green-50 rounded-lg overflow-hidden">
                                      {item.photoUrl && <div className="w-full h-32 relative"><Image src={item.photoUrl} alt={item.name} fill className="object-cover" /></div>}
                                      <div className="p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Camera size={12} className="text-green-600 shrink-0" />
                                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                            <Stars rating={item.rating ?? null} />
                                          </div>
                                        </div>
                                        {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                                        {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                                        {item.alternative && <p className="text-xs text-gray-400 mt-0.5">↔ Alternative: <span className="font-medium text-gray-500">{item.alternative}</span></p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                              </>
                            ) : (
                              <>
                                {group.hotel && hotelCard(group.hotel)}
                                {group.days.map((day, di) => (
                                  <div key={di} className="space-y-2">
                                    {group.days.length > 1 && (
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-1">Day {di + 1}</p>
                                    )}
                                    {day.items.map(item => item.type === 'food_drink' ? (
                                      <div key={item.id} className="bg-orange-50 rounded-lg overflow-hidden">
                                        {item.photoUrl && <div className="w-full h-32 relative"><Image src={item.photoUrl} alt={item.name} fill className="object-cover" /></div>}
                                        <div className="p-3">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <Utensils size={12} className="text-orange-500 shrink-0" />
                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                              <MealPills mealType={item.mealType} />
                                              <Stars rating={item.rating ?? null} />
                                            </div>
                                          </div>
                                          {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                                          {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                                          <FriendProof
                                            friends={friendFoodDetails.get(item.name.toLowerCase()) ?? []}
                                            avg={foodAvgMap.get(item.name.toLowerCase()) ?? null}
                                            total={foodTotalMap.get(item.name.toLowerCase()) ?? 0}
                                            verb="also went"
                                          />
                                          {item.alternative && <p className="text-xs text-gray-400 mt-0.5">↔ Alternative: <span className="font-medium text-gray-500">{item.alternative}</span></p>}
                                        </div>
                                      </div>
                                    ) : (
                                      <div key={item.id} className="bg-green-50 rounded-lg overflow-hidden">
                                        {item.photoUrl && <div className="w-full h-32 relative"><Image src={item.photoUrl} alt={item.name} fill className="object-cover" /></div>}
                                        <div className="p-3">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <Camera size={12} className="text-green-600 shrink-0" />
                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                              <Stars rating={item.rating ?? null} />
                                            </div>
                                          </div>
                                          {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                                          {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                                          {item.alternative && <p className="text-xs text-gray-400 mt-0.5">↔ Alternative: <span className="font-medium text-gray-500">{item.alternative}</span></p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Notes */}
          {it.notes && (
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Notes & Tips</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line">
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

        </div>
      </div>
    </div>
  )
}
