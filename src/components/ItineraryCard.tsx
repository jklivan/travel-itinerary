import Link from 'next/link'
import Image from 'next/image'

type DestItem = { type: string; name: string }
type Destination = { name: string; country: string | null; items: DestItem[] }

type Props = {
  id: string
  title: string
  startDate: Date
  endDate: Date
  audience: string
  authorName: string
  destinations: Destination[]
  coverPhoto: string | null
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

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ItineraryCard({
  id, title, startDate, endDate, audience, authorName, destinations, coverPhoto,
}: Props) {
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

  return (
    <Link href={`/itinerary/${id}`} className="block group">
      <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200">

        {/* Cover */}
        <div className="relative h-52" style={{ backgroundColor: coverColor }}>
          {coverPhoto && (
            <Image src={coverPhoto} alt={title} fill
              className="object-cover group-hover:scale-105 transition-transform duration-300" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
            {destinations.length > 1 && (
              <span className="text-xs bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full">
                {destinations.length} destinations
              </span>
            )}
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              audience === 'adult'
                ? 'bg-rose-500/90 text-white'
                : 'bg-emerald-500/90 text-white'
            }`}>
              {audience === 'adult' ? '18+' : 'Family'}
            </span>
          </div>

          {/* Title + location on cover */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {location && (
              <p className="text-white/80 text-xs mb-1 flex items-center gap-1">
                <span>📍</span>{location}
              </p>
            )}
            <h2 className="text-xl font-bold text-white leading-tight">
              {title}
            </h2>
          </div>
        </div>

        {/* Author row */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: avatarColor }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{authorName}</p>
            <p className="text-xs text-gray-600">
              {days} day{days !== 1 ? 's' : ''} · {fmtDate(startDate)}
            </p>
          </div>
        </div>

        {/* Content preview */}
        {hasItems && (
          <div className="px-4 pb-4 pt-1 space-y-1.5 border-t border-gray-100">
            {hotels.length > 0 && (
              <p className="text-xs text-gray-800 flex gap-2 items-center truncate">
                <span className="shrink-0">🏨</span>
                <span className="truncate">{hotels.map((h) => h.name).join(', ')}</span>
              </p>
            )}
            {food.length > 0 && (
              <p className="text-xs text-gray-800 flex gap-2 items-center truncate">
                <span className="shrink-0">🍽️</span>
                <span className="truncate">{food.map((f) => f.name).join(', ')}</span>
              </p>
            )}
            {activities.length > 0 && (
              <p className="text-xs text-gray-800 flex gap-2 items-center truncate">
                <span className="shrink-0">🎯</span>
                <span className="truncate">{activities.map((a) => a.name).join(', ')}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
