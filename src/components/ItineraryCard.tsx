import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Clock } from 'lucide-react'
import BucketButton from './BucketButton'
import { Caveat } from 'next/font/google'

const caveat = Caveat({ subsets: ['latin'] })

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
const TAPE_COLORS = [
  'rgba(255, 243, 148, 0.85)',
  'rgba(255, 248, 190, 0.85)',
  'rgba(200, 232, 255, 0.85)',
  'rgba(255, 210, 210, 0.85)',
  'rgba(210, 255, 220, 0.85)',
]
const TAPE_ROTATIONS = ['-2.5deg', '-1.5deg', '-0.5deg', '0.5deg', '1.5deg', '2.5deg']

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
  const tapeColor = hashPick(id, TAPE_COLORS)
  const tapeRotation = hashPick(title, TAPE_ROTATIONS)
  const days = tripDays(startDate, endDate)

  const primaryDest = destinations[0]
  const location = primaryDest
    ? `${primaryDest.name}${primaryDest.country ? `, ${primaryDest.country}` : ''}`
    : null

  const showBucket = !isOwn

  return (
    <Link href={`/itinerary/${id}`} className="block w-[clamp(160px,44vw,300px)] relative pt-5">

      {/* Tape */}
      <div
        className="absolute top-1 left-1/2 z-10 w-12 h-7 rounded-[2px]"
        style={{
          backgroundColor: tapeColor,
          transform: `translateX(-50%) rotate(${tapeRotation})`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      />

      {/* Polaroid card */}
      <div
        className="bg-white rounded-[3px] px-4 pt-5 pb-7"
        style={{ boxShadow: '2px 5px 20px rgba(0,0,0,0.16)' }}
      >
        {/* Photo */}
        <div
          className="relative w-full aspect-[4/3] overflow-hidden mb-4"
          style={{ backgroundColor: coverColor }}
        >
          {coverPhoto && (
            <Image src={coverPhoto} alt={title} fill className="object-cover" />
          )}

          {/* Badge */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isGuide && (
              <span className="text-[10px] px-2 py-1 rounded font-semibold bg-black/60 text-white">📖 Guide</span>
            )}
            {!isGuide && audience === 'family' && (
              <span className="text-[10px] px-2 py-1 rounded font-semibold bg-black/60 text-white">👨‍👩‍👧 Family</span>
            )}
          </div>

          {/* Bucket button */}
          {showBucket && (
            <div className="absolute top-2 right-2">
              <BucketButton itineraryId={id} initialBucketed={isBucketed} isLoggedIn={!!currentUserId} />
            </div>
          )}
        </div>

        {/* Caption */}
        <div>
          <h2 className={`${caveat.className} text-xl text-gray-900 leading-tight line-clamp-2 mb-2`}>
            {title}
          </h2>

          <div className="flex items-center justify-between text-xs text-gray-400">
            {location && (
              <span className="flex items-center gap-1 truncate min-w-0">
                <MapPin size={9} className="shrink-0" />
                {location}
              </span>
            )}
            {!isGuide && (
              <span className="flex items-center gap-1 shrink-0 ml-2">
                <Clock size={9} />
                {days}d
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <span className={`${caveat.className} text-sm text-gray-500 truncate`}>
              {authorName}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
