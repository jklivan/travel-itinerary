import Comments from '@/components/Comments'
import { hasTripDates, tripDuration } from '@/lib/dayTrips'
import CopyTripButton from '@/components/CopyTripButton'
import RatingStars from '@/components/RatingStars'
import { prisma } from '@/lib/prisma'
import { after } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import Image from 'next/image'
import PhotoStrip from '@/components/PhotoStrip'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'
import { Plane, Hotel, Utensils, Camera, MapPin, Check, Ban, Star, Users } from 'lucide-react'
import BucketButton from '@/components/BucketButton'
import LikeButton from '@/components/LikeButton'
import { eventPhotos, pickEventPhoto, tripPhotoGallery } from '@/lib/eventPhotos'
import DeleteButton from '@/components/DeleteButton'
import { TRIP_STAMPS, STAMP_COLORS } from '@/lib/tripStamps'
import { tripLocationLabel } from '@/lib/tripLocation'
import { locateTripPlaces, needsLocating } from '@/lib/locatePlaces'
import TagChip, { TAG_PILL } from '@/components/ui/TagChip'
import LikesSheetButton from '@/components/LikesSheet'
import Stamp from '@/components/ui/Stamp'
import ItineraryMap from '@/components/ItineraryMap'
import type { ItemPin } from '@/components/ItineraryMapInner'
import styles from './places.module.css'
import PlaceDetailsCard from '@/components/PlaceDetailsCard'
import PublishPreviewBar from '@/components/PublishPreviewBar'
import GooglePlaceThumb from '@/components/GooglePlaceThumb'
import UserAvatar from '@/components/UserAvatar'
import FriendRatingsButton from '@/components/FriendRatingsButton'
import DestinationSocial, { type DestinationFriend } from '@/components/DestinationSocial'
import { getRecommendation, partitionPlaces } from '@/lib/placeRecommendation'
import { mapDayNumber } from '@/lib/mapDays'
import { distanceMiles } from '@/lib/distance'

type FriendRating = { friendName: string; rating: number | null; itineraryId: string }

// On the card: one friend's name and stars, or for several friends a "Friends' rating" average that opens
// the full list. Everything is also in the place's popup.
function FriendSummary({ friends, verb, placeName }: { friends: FriendRating[]; verb: string; placeName: string }) {
  if (friends.length === 0) return null
  const rated = friends.filter(friend => friend.rating != null && friend.rating > 0)
  const average = rated.length ? rated.reduce((sum, friend) => sum + friend.rating!, 0) / rated.length : null
  return (
    <div className={styles.socialProof}>
      <p className={styles.friendRow}>
        {friends.length === 1
          ? <><span className={styles.friendName}>{friends[0].friendName.split(' ')[0]}</span>{average !== null ? <RatingStars value={average} label={`${friends[0].friendName} rated it ${average} out of 5`} /> : <span>{verb}</span>}</>
          : <FriendRatingsButton friends={friends} placeName={placeName} verb={verb} />}
      </p>
    </div>
  )
}

// In the place's popup: the poster's rating, the community rating (every shared trip with this place, this one
// included, matching "See all trips"; shown once another trip has it), then each friend's rating with a link to their trip.
function RatingsDetails({ itemId, authorName, authorRating, friends, avg, total, trips }: { itemId: string; authorName: string; authorRating: number | null | undefined; friends: FriendRating[]; avg: number | null; total: number; trips: number }) {
  if (!authorRating && friends.length === 0 && trips < 2) return null
  return (
    <section className={styles.ratingsDetails}>
      <h3>Ratings</h3>
      {!!authorRating && <p className={styles.ratingsRow}><span className={styles.friendName}>{authorName}</span><RatingStars value={authorRating} label={`${authorName} rated it ${authorRating} out of 5`} /></p>}
      {trips > 1 && <Link href={`/place/${itemId}`} className={`${styles.ratingsRow} ${styles.communityLink}`}>
        <span>Community rating</span>
        {avg !== null && total > 0 ? <><RatingStars value={avg} label={`Community rating ${avg.toFixed(1)} out of 5 from ${total} ratings`} /><span>{avg.toFixed(1)} · {total} {total === 1 ? 'rating' : 'ratings'}</span></> : <span>No ratings yet</span>}
        <span className={styles.ratingsTripLink}>See all trips →</span>
      </Link>}
      {friends.length > 0 && <div className={styles.ratingsGroup}><p className={styles.ratingsGroupTitle}>Friends who went</p>
        {friends.map((friend, index) => <p key={`${friend.itineraryId}-${index}`} className={styles.ratingsRow}>
          <span className={styles.friendName}>{friend.friendName}</span>
          {friend.rating ? <RatingStars value={friend.rating} label={`${friend.friendName} rated it ${friend.rating} out of 5`} /> : <span>Went, no rating</span>}
          <Link href={`/itinerary/${friend.itineraryId}`} className={styles.ratingsTripLink}>See trip →</Link>
        </p>)}
      </div>}
    </section>
  )
}

type DestItemRow = { id: string; type: string; mealType?: string | null; name: string; description?: string | null; notes?: string | null; address?: string | null; rating?: number | null; priceLevel?: number | null; familyFriendly?: boolean | null; link?: string | null; groupIndex?: number; dayIndex?: number | null; tags?: string[]; alternative?: string | null; photoUrl?: string | null; photoUrls?: string[]; lat?: number | null; lng?: number | null; placeId?: string | null }

type DestinationGroup = {
  id: string
  name: string
  country: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  items: DestItemRow[]
}

function localityKey(name: string, country?: string | null) {
  const parts = name.split(',').map(part => part.trim()).filter(Boolean)
  // A destination selected as a street or venue often ends with the useful
  // locality (city, state, country). Use that suffix when it is available.
  if (parts.length >= 2) return parts.slice(-2).join('|').toLowerCase() + `|${(country ?? '').toLowerCase()}`
  return null
}

function representativeCoordinates(destination: DestinationGroup) {
  if (destination.lat != null && destination.lng != null) return { lat: destination.lat, lng: destination.lng }
  const located = destination.items.find(item => item.lat != null && item.lng != null)
  return located?.lat != null && located.lng != null ? { lat: located.lat, lng: located.lng } : null
}

function mergeNearbyDestinations<T extends DestinationGroup>(destinations: T[]): DestinationGroup[] {
  const groups: DestinationGroup[] = []
  for (const destination of destinations) {
    const coords = representativeCoordinates(destination)
    const key = localityKey(destination.name, destination.country)
    const existing = groups.find(group => {
      const sameLocality = key && localityKey(group.name, group.country) === key
      const groupCoords = representativeCoordinates(group)
      const nearby = coords && groupCoords && distanceMiles(coords, groupCoords) <= 15
      return sameLocality || nearby
    })
    if (!existing) {
      groups.push({
        id: destination.id,
        name: destination.name,
        country: destination.country,
        notes: destination.notes,
        lat: destination.lat,
        lng: destination.lng,
        items: [...destination.items],
      })
    } else {
      existing.items.push(...destination.items)
      if (!existing.notes && destination.notes) existing.notes = destination.notes
    }
  }
  return groups
}

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
  transport: { label: 'Transportation', eyebrow: 'Getting around', Icon: Plane },
} as const

type PlaceCategory = keyof typeof PLACE_CATEGORIES

// Trip-page chips use the shared .chip (globals.css); colours below only override its background.

const MEAL_GROUPS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'other', label: 'More places to eat' },
] as const
// A place tagged with several meals (e.g. lunch and dinner) is listed under the first of them.
function mealGroup(mealType: string | null | undefined) {
  const types = (mealType ?? '').split(',').map(type => type.trim().toLowerCase())
  return MEAL_GROUPS.find(group => types.includes(group.value))?.value ?? 'other'
}

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
  searchParams: Promise<{ view?: string; preview?: string }>
}) {
  const { id } = await params
  const { view, preview: previewParam } = await searchParams
  const session = await auth()

  const it = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, image: true } },
      destinations: {
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      },
      photos: { orderBy: { isStock: 'asc' } },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, image: true } },
          replies: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true, image: true } } } },
        },
      },
    },
  })

  if (!it) notFound()

  const isOwn = session?.user?.id === it.user.id
  // A venue name can be stored as a destination when it was added from a story.
  // Merge nearby destination buckets for display so one local trip does not
  // produce a separate heading for every venue.
  const groupedDestinations = mergeNearbyDestinations(it.destinations as unknown as DestinationGroup[])
  const mainDestinations = groupedDestinations.map(dest => ({ ...dest, items: partitionPlaces(dest.items).main })).filter(dest => dest.items.length > 0)
  const alternativeDestinations = groupedDestinations.map(dest => ({ ...dest, items: partitionPlaces(dest.items).alternatives })).filter(dest => dest.items.length > 0)
  const days = tripDuration(it)
  const isGuide = days === null
  const hasDailyPlan = !isGuide && mainDestinations.some(dest => dest.items.some(item => (it.isPlan || item.type !== 'hotel') && item.dayIndex != null))
  const showDayByDay = view === 'day-by-day' && hasDailyPlan
  const showMap = view === 'map'

  if (it.visibility === 'draft' && !isOwn) notFound()
  // ?preview=1: a private plan shown as it will look once posted (from "A few more details" → Continue).
  const previewing = previewParam === '1' && it.visibility === 'draft' && isOwn && it.isPlan
  if (it.visibility === 'draft' && isOwn && it.isPlan && !previewing) redirect(`/plan/${it.id}`)
  // Plan-based trips are edited in the planner. Link there directly: the editor's server redirect
  // to /plan fails during in-app navigation and leaves a blank page.
  const editHref = `/plan/${it.id}`


  const [followRecord, bucketItem, likeCount, viewerLike] = await Promise.all([
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
    prisma.tripLike.count({ where: { itineraryId: id } }),
    session?.user?.id ? prisma.tripLike.findUnique({ where: { userId_itineraryId: { userId: session.user.id, itineraryId: id } }, select: { id: true } }) : Promise.resolve(null),
  ])
  const followStatus = followRecord?.status ?? 'none'
  const isBucketed = !!bucketItem

  // Social proof data
  const destNamesLower = it.destinations.map(d => d.name.toLowerCase())
  // This trip's places, for finding the same places in friends' trips (and your own).
  const placeItems = it.destinations.flatMap(d => d.items).filter(item => item.name && ['hotel', 'food_drink', 'activity'].includes(item.type))
  const placeNamesLower = [...new Set(placeItems.map(item => item.name.toLowerCase()))]
  const placeIds = [...new Set(placeItems.flatMap(item => item.placeId ? [item.placeId] : []))]
  const viewerId = session?.user?.id && !isOwn ? session.user.id : null

  const friendIds: string[] = session?.user?.id
    ? (await prisma.follow.findMany({
        where: { followerId: session.user.id, status: 'accepted' },
        select: { followingId: true },
      })).map(f => f.followingId)
    : []

  type SaverRow = { name: string; user_id: string; user_name: string }
  type FriendNameRow = { name: string; friend_name: string; itinerary_id: string }
  type FriendDetailRow = { name: string; type: string; friend_name: string; user_id: string; rating: number | null; itinerary_id: string; place_id: string | null }
  type AvgRow = { item_id: string; total: bigint; avg_rating: number | null; trips: bigint }
  type BucketerRow = { friend_name: string }

  const [friendDestRows, savedDestRows, friendPlaceRows, placeAvgRows, itineraryBucketersRows] = await Promise.all([
    // Which friends visited the same destinations (exclude the current itinerary itself)
    friendIds.length > 0 && destNamesLower.length > 0
      ? prisma.$queryRaw<FriendNameRow[]>(Prisma.sql`
          SELECT DISTINCT ON (LOWER(d.name), i."userId") LOWER(d.name) AS name, u.name AS friend_name, i.id AS itinerary_id
          FROM "Destination" d
          JOIN "Itinerary" i ON i.id = d."itineraryId"
          JOIN "User" u ON u.id = i."userId"
          WHERE i."userId" IN (${Prisma.join(friendIds)})
            AND LOWER(d.name) IN (${Prisma.join(destNamesLower)})
            AND i.visibility != 'draft'
            AND i.id != ${id}
          ORDER BY LOWER(d.name), i."userId", i."createdAt" DESC
        `)
      : Promise.resolve([] as FriendNameRow[]),
    // Who saved shared trips with each destination (only friends' names are shown; others are counted)
    destNamesLower.length > 0
      ? prisma.$queryRaw<SaverRow[]>(Prisma.sql`
          SELECT DISTINCT LOWER(d.name) AS name, b."userId" AS user_id, u.name AS user_name
          FROM "BucketListItem" b
          JOIN "Itinerary" i ON i.id = b."itineraryId"
          JOIN "Destination" d ON d."itineraryId" = i.id
          JOIN "User" u ON u.id = b."userId"
          WHERE LOWER(d.name) IN (${Prisma.join(destNamesLower)})
            AND i.visibility != 'draft'
        `)
      : Promise.resolve([] as SaverRow[]),
    // Friends' shared trips, and all of your own trips, with any of this trip's places (by Google place or name).
    (friendIds.length > 0 || viewerId) && (placeNamesLower.length > 0 || placeIds.length > 0)
      ? prisma.$queryRaw<FriendDetailRow[]>(Prisma.sql`
          SELECT LOWER(di.name) AS name, di.type, di."placeId" AS place_id, di.rating, i.id AS itinerary_id, i."userId" AS user_id, u.name AS friend_name
          FROM "DestItem" di
          JOIN "Destination" d ON d.id = di."destinationId"
          JOIN "Itinerary" i ON i.id = d."itineraryId"
          JOIN "User" u ON u.id = i."userId"
          WHERE i.id != ${id}
            AND (
              ${friendIds.length > 0 ? Prisma.sql`(i."userId" IN (${Prisma.join(friendIds)}) AND i.visibility != 'draft')` : Prisma.sql`FALSE`}
              OR ${viewerId ? Prisma.sql`i."userId" = ${viewerId}` : Prisma.sql`FALSE`}
            )
            AND (
              ${placeNamesLower.length > 0 ? Prisma.sql`LOWER(di.name) IN (${Prisma.join(placeNamesLower)})` : Prisma.sql`FALSE`}
              OR ${placeIds.length > 0 ? Prisma.sql`di."placeId" IN (${Prisma.join(placeIds)})` : Prisma.sql`FALSE`}
            )
        `)
      : Promise.resolve([] as FriendDetailRow[]),
    // Match every current place to published ratings by place ID or name.
    // Key by item ID so spelling variants resolve to the correct card.
    prisma.$queryRaw<AvgRow[]>(Prisma.sql`
      SELECT item_id, COUNT(*) FILTER (WHERE rating > 0) AS total, AVG(rating::float) FILTER (WHERE rating > 0) AS avg_rating, COUNT(*) AS trips
      FROM (
        SELECT current_item.id AS item_id, rated_dest."itineraryId", MAX(rated.rating) AS rating
        FROM "DestItem" current_item
        JOIN "Destination" current_dest ON current_dest.id = current_item."destinationId"
        JOIN "DestItem" rated ON (
            (current_item."placeId" IS NOT NULL AND rated."placeId" = current_item."placeId")
            OR (rated.type = current_item.type AND LOWER(rated.name) = LOWER(current_item.name))
          )
        JOIN "Destination" rated_dest ON rated_dest.id = rated."destinationId"
        JOIN "Itinerary" rated_trip ON rated_trip.id = rated_dest."itineraryId"
        WHERE current_dest."itineraryId" = ${id}
          AND rated_trip.visibility != 'draft'
        GROUP BY current_item.id, rated_dest."itineraryId"
      ) per_trip
      GROUP BY item_id
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
  // Each destination (lowercase name) → friends who've been, and who saved a trip there.
  const friendDestNames = new Map<string, DestinationFriend[]>()
  for (const r of friendDestRows) friendDestNames.set(r.name, [...(friendDestNames.get(r.name) ?? []), { name: r.friend_name, itineraryId: r.itinerary_id }])
  const savedDestMap = new Map<string, { names: string[]; total: number }>()
  for (const r of savedDestRows) {
    const current = savedDestMap.get(r.name) ?? { names: [], total: 0 }
    const name = r.user_id === session?.user?.id ? 'You' : friendIds.includes(r.user_id) ? r.user_name : null
    savedDestMap.set(r.name, { names: name ? [...current.names, name] : current.names, total: current.total + 1 })
  }
  const destinationSocial = (dest: { name: string }) => <DestinationSocial destination={dest.name} friends={friendDestNames.get(dest.name.toLowerCase()) ?? []} savers={savedDestMap.get(dest.name.toLowerCase()) ?? { names: [], total: 0 }} />

  // Each place → the friends who have it (one entry per friend, their best rating), with you first.
  // The same Google place matches in any category; otherwise the name must match in the same category.
  const friendsByItem = new Map<string, FriendRating[]>()
  for (const item of placeItems) {
    const best = new Map<string, FriendDetailRow>()
    for (const row of friendPlaceRows) {
      if (!((item.placeId && row.place_id === item.placeId) || (row.type === item.type && row.name === item.name.toLowerCase()))) continue
      const current = best.get(row.user_id)
      if (!current || (row.rating ?? 0) > (current.rating ?? 0)) best.set(row.user_id, row)
    }
    const friends = [...best.values()].sort((a, b) => Number(b.user_id === viewerId) - Number(a.user_id === viewerId))
      .map(row => ({ friendName: row.user_id === viewerId ? 'You' : row.friend_name, rating: row.rating, itineraryId: row.itinerary_id }))
    if (friends.length) friendsByItem.set(item.id, friends)
  }

  const placeRatings = new Map(placeAvgRows.map(row => [row.item_id, {
    avg: row.avg_rating == null ? null : Number(row.avg_rating),
    total: Number(row.total),
    trips: Number(row.trips),
  }]))

  // friends who saved this itinerary
  const itineraryFriendBucketers = itineraryBucketersRows.map(r => r.friend_name)

  const audienceLabel = ({ family: 'Family', friends: 'Friends', romantic: 'Couples', adult: 'Adults' } as Record<string, string>)[it.audience]
  const displayTags = it.tags

  // Build map pins from geocoded items
  // Posted trips with places that have no saved map spot (e.g. built in the planner before it saved them), or a pin
  // far from the rest: look them up in the background, so the map is right on the next visit.
  if (it.visibility !== 'draft' && needsLocating(it.destinations.flatMap(d => d.items))) after(() => locateTripPlaces(it.id).catch(() => {}))
  const mapPins: ItemPin[] = it.destinations.flatMap(d => {
    const zeroBased = d.items.some(item => item.type !== 'hotel' && item.dayIndex === 0)
    return d.items
      .filter(i => i.lat != null && i.lng != null)
      .map(i => ({
        id: i.id,
        name: i.name,
        type: i.type as 'hotel' | 'food_drink' | 'activity' | 'transport',
        lat: i.lat!,
        lng: i.lng!,
        day: isGuide || i.type === 'hotel' || getRecommendation(i.tags) === 'option' ? null : mapDayNumber(i.dayIndex, zeroBased),
        recommendation: getRecommendation(i.tags),
      }))
  })

  function fmtShort(d: Date) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const placeDestinations = new Map(groupedDestinations.flatMap(destination =>
    destination.items.map(item => [item.id, [destination.name, destination.country].filter(Boolean).join(', ')] as const)
  ))

  const stamp = it.tripRating ? TRIP_STAMPS.find(s => s.value === it.tripRating) : null
  // Card label for the poster's own rating: their first name, or "You" on your own trip.
  const authorFirst = isOwn ? 'You' : it.user.name.split(' ')[0]

  // Use the same paper cards throughout highlights, daily plans, and guides.
  const renderPlaceCard = (item: DestItemRow, type: PlaceCategory, compact = false) => {
    const { eyebrow, Icon } = PLACE_CATEGORIES[type]
    const recommendation = getRecommendation(item.tags)
    const tilePhoto = pickEventPhoto(eventPhotos(item.photoUrls, item.photoUrl))
    const friends = friendsByItem.get(item.id) ?? []
    const { avg = null, total = 0, trips = 0 } = placeRatings.get(item.id) ?? {}
    const label = type === 'food_drink' && item.mealType
      ? item.mealType.split(',').map(meal => meal.trim()).filter(Boolean).join(' · ')
      : eyebrow
    const price = item.priceLevel == null ? null : Math.max(0, Math.min(type === 'hotel' ? 5 : 4, item.priceLevel))

    return (
      <div key={item.id} id={`place-${item.id}`} className="scroll-mt-24">
      <PlaceDetailsCard messageHref={!isOwn ? `/messages/${it.user.id}?place=${encodeURIComponent(item.id)}` : undefined} editHref={isOwn ? editHref : undefined} place={item} destination={placeDestinations.get(item.id) ?? ''} category={PLACE_CATEGORIES[type].label} recommendation={recommendation} isHotel={type === 'hotel'} ratings={<RatingsDetails itemId={item.id} authorName={isOwn ? 'You' : it.user.name} authorRating={item.rating} friends={friends} avg={avg} total={total} trips={trips} />} className={`${styles.card} ${styles[type]} ${isOwn ? styles.ownerPolaroid : ''} ${recommendation !== 'none' && recommendation !== 'must' ? styles.stamped : ''} ${recommendation === 'option' ? styles.alternativeCard : ''}`}>
        {recommendation === 'must' && <Stamp small label={type === 'hotel' ? 'Must stay!' : 'Must do!'} color={STAMP_COLORS[5]} className={`${styles.mustDoStamp} ${styles.verdictStamp}`} />}
        {recommendation === 'avoid' && <span className={`${styles.mustDoStamp} ${styles.textStamp} ${styles.avoidStamp}`}><Ban size={24} aria-hidden="true" /><span>Avoid</span></span>}
        {recommendation === 'option' && <span className={`${styles.mustDoStamp} ${styles.textStamp}`}><span>Alternative</span></span>}
        {tilePhoto ? (
          <div className={`${styles.thumbnail} photo-polaroid`}>
            <span className="photo-polaroid-image"><Image src={tilePhoto} alt="" fill sizes="132px" className="object-cover" /></span>
          </div>
        ) : (
          <div className={`${styles.thumbnail} photo-polaroid`}>
            <span className="photo-polaroid-image">
              <span className={styles.keepsake} aria-hidden="true">
                <span>{eyebrow}</span>
                <Icon size={25} strokeWidth={1} />
                <span>{item.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span>
              </span>
              {type !== 'transport' && <GooglePlaceThumb itemId={item.id} />}
            </span>
          </div>
        )}
        <div className={styles.cardBody}>
          <p className={styles.eyebrow}>{label}</p>
          <h4 className={styles.placeName}>{item.name}</h4>
          {(!!item.rating || (!compact && price !== null && price > 0)) && (
            <div className={styles.meta}>
              {!!item.rating && <span className={styles.rating}><RatingStars value={item.rating} label={`${authorFirst} rated it ${item.rating} out of 5 stars`} /> <span className={styles.ratingLabel}>{authorFirst}</span></span>}
              {!compact && price !== null && price > 0 && <span className={styles.price}>{'$'.repeat(price)}</span>}
            </div>
          )}
          {!compact && item.notes && <p className={styles.note}>{item.notes}</p>}
          {recommendation === 'option' && <p className={styles.recommendation}>Saved as an alternative</p>}
          {recommendation === 'must' && <p className={styles.recommendation}><Check size={12} /> {type === 'hotel' ? 'Must stay' : 'Trip highlight'}</p>}
          <FriendSummary friends={friends} placeName={item.name} verb={type === 'hotel' ? 'stayed here' : type === 'activity' ? 'also did this' : 'also went'} />
        </div>
      </PlaceDetailsCard>
      </div>
    )
  }

  const renderHotelCard = (item: DestItemRow, compact = false) => renderPlaceCard(item, 'hotel', compact)
  const renderFoodCard = (item: DestItemRow, compact = false) => renderPlaceCard(item, 'food_drink', compact)
  const renderActivityCard = (item: DestItemRow, compact = false) => renderPlaceCard(item, item.type === 'transport' ? 'transport' : 'activity', compact)

  return (
    <div className="min-h-screen bg-paper">
      {previewing && <PublishPreviewBar id={it.id} postType={it.postType} budget={it.budget} tripRating={it.tripRating} tags={it.tags} />}
      <div className={`max-w-4xl mx-auto px-4 ${isOwn ? 'pt-2 pb-6' : 'py-6'}`}>

        {previewing ? (
          <div className="panel-hint mb-4 px-3 py-2 text-xs font-medium text-ink">
            Preview — only you can see this. It’s how your trip will look once you post it.
          </div>
        ) : it.visibility === 'draft' && (
          <div className="mb-4 bg-sand border border-gold-faint rounded-lg px-3 py-2 text-xs text-brown font-medium">
            Draft — only visible to you. <Link href={editHref} className="underline">Edit &amp; publish</Link>
          </div>
        )}

        {/* ── Editorial Header ── */}
        <div className="mb-2">
          <h1 className={`trip-title font-[family-name:var(--font-playfair)] text-display sm:text-display-lg text-ink leading-tight mb-2 uppercase`}>
            {it.title}
          </h1>

          {tripLocationLabel(it.destinations) && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brown">{tripLocationLabel(it.destinations)}</p>}

          <div aria-label="Trip tags" className="flex flex-wrap gap-2 items-center mb-4">
            {/* Like (public heart, with its count) and Save (private, to your folders). */}
            <LikeButton variant="pill" itineraryId={it.id} initialLiked={!!viewerLike} initialCount={likeCount} isLoggedIn={!!session?.user} />
            {!isOwn && <BucketButton key={String(isBucketed)} itineraryId={it.id} initialBucketed={isBucketed} isLoggedIn={!!session?.user} size="md" withFolders={!!session?.user} />}
            {/* One chip style for everything here; the verdict uses its stamp colour, as on the trip cards. */}
            {stamp && <span className={`${TAG_PILL} text-white`} style={{ backgroundColor: STAMP_COLORS[stamp.value] }}><Star size={14} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />{stamp.label}</span>}
            {!!it.budget && it.budget > 0 && <span aria-label={`Budget ${it.budget} out of 5`} className={`${TAG_PILL} gap-1 bg-chip`}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= it.budget! ? 'text-ink' : 'text-gold-faint'}>$</span>)}</span>}
            {audienceLabel && <span className={`${TAG_PILL} bg-chip text-ink`}><Users size={15} strokeWidth={1.5} aria-hidden="true" />{audienceLabel}</span>}
            {displayTags.map(tag => <TagChip key={tag} id={tag} />)}
            {it.bestMonths && it.bestMonths.length > 0 && it.bestMonths.map(m => (
              <span key={m} className={`${TAG_PILL} bg-mist text-ink`}>{m}</span>
            ))}
          </div>

          {/* Italic description */}
          {it.description && (
            <p className="font-[family-name:var(--font-playfair)] italic text-ink-soft text-lg mb-3">
              {it.description}
            </p>
          )}

          {/* Author row, one line: who posted it | when and how long, with Follow on the right. */}
          <div className="flex items-center gap-3 border-t border-b border-line-strong py-3 mb-2">
            <Link href={`/user/${it.user.id}`} className="flex shrink-0 items-center gap-2 hover:opacity-80">
              <UserAvatar name={it.user.name} image={it.user.image} size={32} />
              <span className="text-sm text-ink">{it.user.name}</span>
            </Link>
            {(isGuide || days !== null) && <>
              <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line-strong" />
              <span className="min-w-0 flex-1 text-label leading-snug text-brown">
                {/* Exact dates are private to the person who made the trip; everyone else sees the length. */}
                {isGuide ? 'Guide' : <>{isOwn && hasTripDates(it) && `${fmtShort(it.startDate)} – ${fmtShort(it.endDate)} · `}{days} {days === 1 ? 'day' : 'days'}</>}
              </span>
            </>}
            {session?.user && !isOwn && (
              <form className="ml-auto shrink-0" action={async () => {
                'use server'
                if (followStatus === 'accepted') await unfollowUser(it.user.id)
                else if (followStatus === 'pending') await cancelFollowRequest(it.user.id)
                else await sendFollowRequest(it.user.id)
              }}>
                <button type="submit" aria-pressed={followStatus === 'accepted'} className="chip">
                  {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : '+ Follow'}
                </button>
              </form>
            )}
          </div>


          {/* Friends who saved this trip */}
          <div className="flex flex-wrap gap-2 items-center">
            {itineraryFriendBucketers.length > 0 && (
              <span className="text-xs text-brown">
                {/* Opens everyone who saved (liked) this trip, as on the feed. */}
                <LikesSheetButton itineraryId={it.id} title={it.title} plain>🔖 <span className="font-medium text-ink-soft">
                  {itineraryFriendBucketers.slice(0, 3).map(n => n.split(' ')[0]).join(', ')}
                </span>
                {itineraryFriendBucketers.length > 3 && ` +${itineraryFriendBucketers.length - 3} more`} saved this</LikesSheetButton>
              </span>
            )}
          </div>
        </div>

        {/* Same underlined tabs as the planner. */}
        <nav aria-label="Itinerary view" className="tabs mb-5">
          <Link href={`/itinerary/${it.id}`} scroll={false} aria-current={!showMap && !showDayByDay ? 'page' : undefined} className="tab">Summary</Link>
          {hasDailyPlan && <Link href={`/itinerary/${it.id}?view=day-by-day`} scroll={false} aria-current={showDayByDay ? 'page' : undefined} className="tab">Itinerary</Link>}
          {mapPins.length > 0 && <Link href={`/itinerary/${it.id}?view=map`} scroll={false} aria-current={showMap ? 'page' : undefined} className="tab">Map View</Link>}
        </nav>

        {showMap && (
          <div className="h-[60vh] rounded-2xl overflow-hidden border border-line-strong mb-6">
            <ItineraryMap pins={mapPins} />
          </div>
        )}

        {!showMap && (
          <>
            {showDayByDay && it.isPlan && <div className="space-y-6 mb-10">
              {[...new Set(mainDestinations.flatMap(d => d.items.flatMap(i => i.dayIndex === null ? [] : [i.dayIndex])))].sort((a, b) => (a ?? 0) - (b ?? 0)).concat([-1]).map(day => {
                const items = mainDestinations.flatMap(d => d.items).filter(i => day === -1 ? i.dayIndex === null : i.dayIndex === day)
                return items.length > 0 && <section key={day}><h2 className={styles.dayHeading}>{day === -1 ? 'Unscheduled' : `Day ${day}`}</h2><div className={styles.cardColumns}>{items.map(item => renderPlaceCard(item, item.type === 'hotel' ? 'hotel' : item.type === 'food_drink' ? 'food_drink' : item.type === 'transport' ? 'transport' : 'activity'))}</div></section>
              })}
            </div>}
            {/* ── Day by Day (itineraries) ── */}
            {showDayByDay && !it.isPlan && mainDestinations.length > 0 && (
              <div className="mb-10">
                <h2 className="type-title mb-1">Day by Day</h2>
                <div className="h-px bg-line-strong mb-5" />
                {/* Cards two across on wider screens, the same size as the Summary view's. */}
                <div className="space-y-10">
                  {mainDestinations.map((dest) => {
                    const groups = groupItems(dest.items as DestItemRow[])
                    const multiStay = groups.length > 1
                    const dayOffset = dest.items.some(item => item.type !== 'hotel' && item.dayIndex === 0) ? 1 : 0
                    const dayNumber = (day: number) => Math.max(1, day + dayOffset)
                    return (
                      <div key={dest.id}>
                        {mainDestinations.length > 1 && (
                          <p className="text-xs uppercase tracking-widest text-brown font-semibold mb-2 flex items-center gap-1">
                            <MapPin size={11} /> {dest.name}{dest.country ? `, ${dest.country}` : ''}
                          </p>
                        )}
                        {destinationSocial(dest)}
                        {dest.notes && <p className="text-xs text-brown italic mb-3 border-l-2 border-line-strong pl-2">{dest.notes}</p>}
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
                                          <span className="text-xs font-bold text-cream bg-ink px-2.5 py-1 rounded-full">Day {dn}</span>
                                        </div>
                                        {di === 0 && group.hotel && <div className={styles.cardColumns}>{renderHotelCard(group.hotel)}</div>}
                                        <div className={`${styles.cardColumns} mt-2`}>
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
                                  {group.hotel && <div className={styles.cardColumns}>{renderHotelCard(group.hotel)}</div>}
                                  {group.days.map((day, di) => (
                                    <div key={di}>
                                      {(group.days.length > 1 || dayNumber(day.dayIndex) > 1) && (
                                        <div className="flex items-center gap-2 mb-2 mt-2">
                                          <span className="text-xs font-bold text-cream bg-ink px-2.5 py-1 rounded-full">Day {dayNumber(day.dayIndex)}</span>
                                        </div>
                                      )}
                                      <div className={styles.cardColumns}>
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
            {!showDayByDay && mainDestinations.length > 0 && (
              <div className="mb-10">
                <h2 className="type-title mb-1">Places from the trip</h2>
                <div className="h-px bg-line-strong mb-5" />
                <div className="space-y-10">
                  {mainDestinations.map((dest) => {
                    const dItems = dest.items as DestItemRow[]
                    const dHotels = dItems.filter(i => i.type === 'hotel')
                    const dFood = dItems.filter(i => i.type === 'food_drink')
                    const dActs = dItems.filter(i => i.type === 'activity')
                    const dTransport = dItems.filter(i => i.type === 'transport')
                    return (
                      <div key={dest.id}>
                        {mainDestinations.length > 1 && (
                          <p className="text-xs uppercase tracking-widest text-brown font-semibold mb-3 flex items-center gap-1">
                            <MapPin size={11} /> {dest.name}{dest.country ? `, ${dest.country}` : ''}
                          </p>
                        )}
                        {destinationSocial(dest)}
                        {dest.notes && <p className="text-xs text-brown italic mb-3 border-l-2 border-line-strong pl-2">{dest.notes}</p>}
                        <div className={styles.categoryStack}>
                          {dHotels.length > 0 && (
                            <div>
                              <CategoryHeading type="hotel" count={dHotels.length} />
                              <div className={styles.cardColumns}>{dHotels.map(item => renderHotelCard(item))}</div>
                            </div>
                          )}
                          {dFood.length > 0 && (
                            <div>
                              <CategoryHeading type="food_drink" count={dFood.length} />
                              <div className="space-y-5">
                                {MEAL_GROUPS.map(group => {
                                  const meals = dFood.filter(item => mealGroup(item.mealType) === group.value)
                                  if (meals.length === 0) return null
                                  return (
                                    <section key={group.value} aria-label={group.label}>
                                      {/* No heading when no restaurant has a meal type. */}
                                      {!(group.value === 'other' && meals.length === dFood.length) && <h4 className="type-label mb-2">{group.label}</h4>}
                                      <div className={styles.cardColumns}>{meals.map(item => renderFoodCard(item))}</div>
                                    </section>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {dActs.length > 0 && (
                            <div>
                              <CategoryHeading type="activity" count={dActs.length} />
                              <div className={styles.cardColumns}>{dActs.map(item => renderActivityCard(item))}</div>
                            </div>
                          )}
                          {dTransport.length > 0 && <div><CategoryHeading type="transport" count={dTransport.length} /><div className={styles.cardColumns}>{dTransport.map(item => renderPlaceCard(item, 'transport'))}</div></div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {alternativeDestinations.length > 0 && (
              <section aria-labelledby="alternatives-heading" className="mb-10">
                <h2 id="alternatives-heading" className="type-title mb-1">Alternatives</h2>
                <p className="text-sm text-brown mb-5">Other places to consider.</p>
                <div className="space-y-6">
                  {alternativeDestinations.map(dest => (
                    <div key={dest.id}>
                      {it.destinations.length > 1 && <p className="text-xs uppercase tracking-widest text-brown font-semibold mb-3">{dest.name}{dest.country ? `, ${dest.country}` : ''}</p>}
                      <div className={styles.placeGrid}>
                        {dest.items.map(item => renderPlaceCard(item, item.type === 'hotel' ? 'hotel' : item.type === 'food_drink' ? 'food_drink' : item.type === 'transport' ? 'transport' : 'activity'))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* The poster's general notes and tips come after the places. */}
            {it.notes && (
              <section className="mb-10 border-l-2 border-line-strong pl-4">
                <h2 className="type-label mb-2">Notes &amp; Tips</h2>
                <p className="text-sm leading-relaxed text-ink-soft whitespace-pre-line break-words">{it.notes}</p>
              </section>
            )}

            {it.visibility !== 'draft' && <Comments
              itineraryId={it.id}
              initialComments={it.comments}
              currentUserId={session?.user?.id}
              isLoggedIn={!!session?.user}
            />}
            {!isOwn && <div className="mt-6 border-t border-line-strong pt-6">
              <h2 className="type-label mb-2">Have a question about this trip?</h2>
              <Link href={`/messages/${it.user.id}?trip=${encodeURIComponent(it.id)}`} className="btn btn-primary btn-sm">Message {it.user.name} privately</Link>
            </div>}
          </>
        )}
        {(() => {
          const photos = tripPhotoGallery(it.photos, it.destinations.flatMap(d => d.items), it.coverPhoto)
          const stockPhoto = it.photos.find(photo => photo.isStock)
          const gallery = photos.length ? photos : stockPhoto ? [stockPhoto] : []
          if (!gallery.length) return null
          return <section aria-labelledby="trip-photos-heading" className="mt-8 border-t border-line-strong pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="trip-photos-heading" className="type-title">Trip photos</h2>
            </div>
            <PhotoStrip photos={gallery} title={it.title} gallery />
          </section>
        })()}
        {!isOwn && session?.user && <div className="mt-8 border-t border-line-strong pt-5">
          <CopyTripButton itineraryId={it.id} title={it.title} isOwn={isOwn} />
        </div>}
        {isOwn && <section aria-label="Manage trip" className="mt-8 border-t border-line-strong pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={editHref} className="chip">Edit</Link>
            <Link href={`/plan/${it.id}`} className="chip">Add a place</Link>
            <DeleteButton id={it.id} visibility={it.visibility} />
          </div>
        </section>}
      </div>
    </div>
  )
}
