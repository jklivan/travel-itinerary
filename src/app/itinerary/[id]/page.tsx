import { prisma } from '@/lib/prisma'
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

type DestItemRow = { id: string; type: string; mealType?: string | null; name: string; description?: string | null; notes?: string | null; address?: string | null; rating?: number | null; priceLevel?: number | null; familyFriendly?: boolean | null; link?: string | null; groupIndex?: number; dayIndex?: number | null; tags?: string[] }

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
    <div className="max-w-2xl mx-auto px-4 py-6">
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
          </div>

          {/* Highlights */}
          {highlightGroups.length > 0 && (
            <div className="mb-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-base">⭐</span>
                <h2 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Top Picks</h2>
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
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <MapPin size={14} className="text-blue-600" />
                      {dest.name}{dest.country ? `, ${dest.country}` : ''}
                    </h3>
                    {dest.notes && (
                      <p className="text-xs text-gray-500 italic mb-3 border-l-2 border-blue-200 pl-2">{dest.notes}</p>
                    )}
                    <div className="space-y-3">
                      {(() => {
                        // For multi-stay destinations show Day 1/Day 2 with hotel inline
                        // instead of Stay 1/Stay 2 boxes. Day numbers are sequential across all groups.
                        let dayCounter = 0
                        const hotelCard = (hotel: (typeof groups)[0]['hotel']) => hotel && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Hotel size={14} className="text-blue-600" />
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lodging</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">{hotel.name}</span>
                              {!isGuide && <Stars rating={hotel.rating ?? null} />}
                            </div>
                            {hotel.priceLevel != null && (
                              <p className="text-xs font-medium text-green-700 mt-0.5">
                                {'$'.repeat(hotel.priceLevel)}
                                <span className="text-gray-300">{'$'.repeat(5 - hotel.priceLevel)}</span>
                              </p>
                            )}
                            {hotel.tags && hotel.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {hotel.tags.map(tag => (
                                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{tag}</span>
                                ))}
                              </div>
                            )}
                            {hotel.description && <p className="text-xs text-gray-600 mt-1"><span className="font-semibold text-gray-500">Description: </span>{hotel.description}</p>}
                            {hotel.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{hotel.notes}</p>}
                            {hotel.address && <p className="text-xs text-gray-500 mt-0.5">📍 {hotel.address}</p>}
                            {hotel.link && <a href={hotel.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                          </div>
                        )
                        return groups.map((group, gi) => (
                          <div key={gi} className="space-y-2">
                            {multiStay ? (
                              // Multi-stay: Day N badge, then hotel card only on first day of each stay
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
                                    <div key={item.id} className="bg-orange-50 rounded-lg p-3">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <Utensils size={12} className="text-orange-500 shrink-0" />
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                          <MealPills mealType={item.mealType} />
                                          {!isGuide && <Stars rating={item.rating ?? null} />}
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
                                      {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {item.tags.map(tag => (
                                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{tag}</span>
                                          ))}
                                        </div>
                                      )}
                                      {item.description && <p className="text-xs text-gray-600 mt-1"><span className="font-semibold text-gray-500">Description: </span>{item.description}</p>}
                                      {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                                      {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                                    </div>
                                  ) : (
                                    <div key={item.id} className="bg-green-50 rounded-lg p-3">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <Camera size={12} className="text-green-600 shrink-0" />
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                          {!isGuide && <Stars rating={item.rating ?? null} />}
                                        </div>
                                      </div>
                                      {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                                      {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                              </>
                            ) : (
                              // Single stay: hotel card + day labels
                              <>
                                {group.hotel && hotelCard(group.hotel)}
                                {group.days.map((day, di) => (
                                  <div key={di} className="space-y-2">
                                    {group.days.length > 1 && (
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-1">Day {di + 1}</p>
                                    )}
                                    {day.items.map(item => item.type === 'food_drink' ? (
                                      <div key={item.id} className="bg-orange-50 rounded-lg p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Utensils size={12} className="text-orange-500 shrink-0" />
                                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                            <MealPills mealType={item.mealType} />
                                            {!isGuide && <Stars rating={item.rating ?? null} />}
                                          </div>
                                        </div>
                                        {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                                        {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
                                      </div>
                                    ) : (
                                      <div key={item.id} className="bg-green-50 rounded-lg p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Camera size={12} className="text-green-600 shrink-0" />
                                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                            {!isGuide && <Stars rating={item.rating ?? null} />}
                                          </div>
                                        </div>
                                        {item.notes && <p className="text-xs text-gray-500 italic mt-0.5"><span className="font-semibold not-italic">User notes: </span>{item.notes}</p>}
                                        {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">🔗 Official site</a>}
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
