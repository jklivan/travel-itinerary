import Link from 'next/link'
import Image from 'next/image'
import { Hotel, Utensils, Camera, MapPin } from 'lucide-react'
import BucketButton from './BucketButton'

type DestItem = { type: string; name: string }
type Destination = { name: string; country: string | null; items: DestItem[] }

type Props = {
  id: string
  postType?: string
  title: string
  startDate: Date
  endDate: Date
  audience: string
  authorName: string
  destinations: Destination[]
  coverPhoto: string | null
  // Bucket list
  currentUserId?: string | null
  isOwn?: boolean
  isBucketed?: boolean
}

const COVER_COLORS = [
  '#C0392B', '#1A6BAB', '#7B2D8B', '#1E8449',
  '#CA6F1E', '#A93226', '#117A65', '#1A5276',
]
const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F59E0B', '#EF4444', '#10B981', '#3B82F6',
]

function hashPick(str: string, arr: string[]) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return arr[Math.abs(h) % arr.length]
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function tripDays(start: Date, end: Date) {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
}

export default function ItineraryCard({
  id, postType = 'itinerary', title, startDate, endDate, audience, authorName, destinations, coverPhoto,
  currentUserId, isOwn, isBucketed = false,
}: Props) {
  const isGuide = postType === 'guide'
  const coverColor = hashPick(title, COVER_COLORS)
  const avatarColor = hashPick(authorName, AVATAR_COLORS)
  const initials = getInitials(authorName)
  const days = tripDays(startDate, endDate)

  const primaryDest = destinations[0]
  const location = primaryDest
    ? `${primaryDest.name}${primaryDest.country ? `, ${primaryDest.country}` : ''}`
    : null

  const allItems = destinations.flatMap((d) => d.items)
  const hotels     = allItems.filter((i) => i.type === 'hotel').slice(0, 1)
  const food       = allItems.filter((i) => i.type === 'food_drink').slice(0, 2)
  const activities = allItems.filter((i) => i.type === 'activity').slice(0, 2)
  const hasItems   = hotels.length > 0 || food.length > 0 || activities.length > 0

  const showBucket = !isOwn

  return (
    <Link href={`/itinerary/${id}`} className="block">
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200">

          {/* Author row */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {initials}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{authorName}</p>
                {location && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {location}
                  </p>
                )}
                {showBucket && (
                  <div className="mt-1.5">
                    <BucketButton
                      itineraryId={id}
                      initialBucketed={isBucketed}
                      isLoggedIn={!!currentUserId}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {isGuide ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                  📖 Guide
                </span>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  audience === 'adult' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                }`}>
                  {audience === 'adult' ? 'Adults Only' : 'Family'}
                </span>
              )}
              {!isGuide && (
                <span className="text-xs text-gray-400">{days} day{days !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {/* Cover image */}
          <div className="relative h-52" style={{ backgroundColor: coverColor }}>
            {coverPhoto && (
              <Image src={coverPhoto} alt={title} fill className="object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h2 className="text-lg font-bold text-white leading-snug">{title}</h2>
            </div>
          </div>

          {/* Content sections */}
          {hasItems && (
            <div className="p-4 space-y-2">
              {hotels.length > 0 && (
                <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-2.5">
                  <Hotel className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hotel</p>
                    <p className="text-sm text-gray-900 truncate">{hotels[0].name}</p>
                  </div>
                </div>
              )}
              {food.length > 0 && (
                <div className="flex items-start gap-2 bg-orange-50 rounded-lg p-2.5">
                  <Utensils className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Food & Drink</p>
                    <p className="text-sm text-gray-900 truncate">{food.map((f) => f.name).join(' · ')}</p>
                  </div>
                </div>
              )}
              {activities.length > 0 && (
                <div className="flex items-start gap-2 bg-green-50 rounded-lg p-2.5">
                  <Camera className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activities</p>
                    <p className="text-sm text-gray-900 truncate">{activities.map((a) => a.name).join(' · ')}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Link>
  )
}
