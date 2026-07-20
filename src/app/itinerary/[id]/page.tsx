import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'
import { Hotel, Utensils, Camera, MapPin, Star } from 'lucide-react'
import BucketButton from '@/components/BucketButton'

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

const SECTIONS = [
  { type: 'hotel',      label: 'Hotel',      icon: Hotel,    bg: 'bg-blue-50',   iconClass: 'text-blue-600' },
  { type: 'food_drink', label: 'Food & Drink', icon: Utensils, bg: 'bg-orange-50', iconClass: 'text-orange-600' },
  { type: 'activity',   label: 'Activities',  icon: Camera,   bg: 'bg-green-50',  iconClass: 'text-green-600' },
] as const

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  const it = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      destinations: {
        orderBy: { order: 'asc' },
        include: { items: true },
      },
      photos: true,
    },
  })

  if (!it) notFound()

  const isOwn = session?.user?.id === it.user.id
  const isGuide = it.postType === 'guide'

  if (it.visibility === 'private' && !isOwn) notFound()

  const [followRecord, bucketItem] = await Promise.all([
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
  ])
  const followStatus = followRecord?.status ?? 'none'
  const isBucketed = !!bucketItem

  function fmtShort(d: Date) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const days =
    Math.ceil((new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / 86400000) + 1

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline mb-5 inline-block">
        ← Back to feed
      </Link>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Cover photo */}
        {it.photos.length > 0 && (
          <div className="relative h-64 w-full bg-gray-100">
            <Image src={it.photos[0].url} alt={it.title} fill className="object-cover" priority />
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
                <Link href={`/itinerary/${it.id}/edit`}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
                  Edit
                </Link>
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
              {!isGuide && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  it.audience === 'adult' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                }`}>
                  {it.audience === 'adult' ? 'Adults Only' : 'Family Friendly'}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{it.title}</h1>
            {it.description && (
              <p className="text-gray-600 mt-2 text-sm italic border-l-4 border-blue-200 pl-3">
                &ldquo;{it.description}&rdquo;
              </p>
            )}
          </div>

          {/* Destinations */}
          {it.destinations.length > 0 && (
            <div className="space-y-4 mb-5">
              {it.destinations.map((dest) => (
                <div key={dest.id}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <MapPin size={14} className="text-blue-600" />
                    {dest.name}{dest.country ? `, ${dest.country}` : ''}
                  </h3>
                  <div className="space-y-2">
                    {SECTIONS.map(({ type, label, icon: Icon, bg, iconClass }) => {
                      const items = dest.items.filter((it) => it.type === type)
                      if (items.length === 0) return null
                      return (
                        <div key={type} className={`${bg} rounded-lg p-3`}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Icon size={14} className={iconClass} />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                          </div>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div key={item.id}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                  {item.type === 'food_drink' && (item as { mealType?: string | null }).mealType && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      (item as { mealType?: string | null }).mealType === 'lunch'
                                        ? 'bg-orange-100 text-orange-700'
                                        : (item as { mealType?: string | null }).mealType === 'dinner'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {(item as { mealType?: string | null }).mealType === 'lunch' ? '☀️ Lunch'
                                        : (item as { mealType?: string | null }).mealType === 'dinner' ? '🌙 Dinner'
                                        : '🍹 Drinks'}
                                    </span>
                                  )}
                                  {!isGuide && <Stars rating={item.rating} />}
                                </div>
                                {item.notes && (
                                  <p className="text-xs text-gray-500 italic mt-0.5">{item.notes}</p>
                                )}
                                {item.link && (
                                  <a href={item.link} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">
                                    🔗 Official site
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
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

          {/* Additional photos */}
          {it.photos.length > 1 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Photos</h2>
              <div className="grid grid-cols-3 gap-2">
                {it.photos.slice(1).map((photo) => (
                  <div key={photo.id} className="space-y-1">
                    <div className="relative h-24 rounded-lg overflow-hidden bg-gray-100">
                      <Image src={photo.url} alt={photo.caption ?? ''} fill className="object-cover" />
                    </div>
                    {photo.caption && (
                      <p className="text-xs text-gray-500 text-center">{photo.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
