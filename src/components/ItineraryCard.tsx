import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
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

function hashPick(str: string, arr: string[]) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return arr[Math.abs(h) % arr.length]
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
  const days = tripDays(startDate, endDate)

  const primaryDest = destinations[0]
  const location = primaryDest
    ? `${primaryDest.name}${primaryDest.country ? `, ${primaryDest.country}` : ''}`
    : null

  const showBucket = !isOwn

  return (
    <Link href={`/itinerary/${id}`} className="block shrink-0 w-44 snap-center">
      <div
        className="bg-white rounded p-3 pb-8 hover:scale-[1.02] transition-transform duration-200"
        style={{ boxShadow: '2px 4px 18px rgba(0,0,0,0.18)' }}
      >
        {/* Square photo */}
        <div
          className="relative w-full aspect-square overflow-hidden mb-3"
          style={{ backgroundColor: coverColor }}
        >
          {coverPhoto && (
            <Image src={coverPhoto} alt={title} fill className="object-cover" />
          )}
          {!coverPhoto && (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin size={28} className="text-white/30" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {isGuide && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-black/50 text-white">📖 Guide</span>
            )}
            {!isGuide && audience === 'family' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-black/50 text-white">👨‍👩‍👧 Family</span>
            )}
          </div>

          {/* Bucket button */}
          {showBucket && (
            <div className="absolute top-1.5 right-1.5">
              <BucketButton
                itineraryId={id}
                initialBucketed={isBucketed}
                isLoggedIn={!!currentUserId}
              />
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="px-0.5">
          <h2 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{title}</h2>
          {location && (
            <p className="text-[11px] text-gray-500 flex items-center gap-0.5 mt-0.5 truncate">
              <MapPin size={9} className="shrink-0 text-gray-400" />
              {location}
            </p>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-gray-400 truncate mr-2">{authorName}</p>
            {!isGuide && (
              <span className="text-[11px] text-gray-400 shrink-0">{days}d</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
