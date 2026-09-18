import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { hasTripDates, tripDuration } from '@/lib/dayTrips'
import { tripSeason } from '@/lib/tripSeason'
import { TRIP_STAMPS } from '@/lib/tripStamps'
import PhotoStrip from './PhotoStrip'
import BucketButton from './BucketButton'
import { Amatic_SC, Kalam } from 'next/font/google'

const amatic = Amatic_SC({ subsets: ['latin'], weight: '700' })
const kalam = Kalam({ subsets: ['latin'], weight: '400' })

type DestItem = { type: string; name: string; dayIndex?: number | null }
type Destination = { lat?: number | null; name: string; country: string | null; items: DestItem[] }

type Props = {
  id: string
  postType: string
  title: string
  startDate: Date
  endDate: Date
  audience: string
  budget?: number | null
  tripRating: number | null
  authorName: string
  destinations: Destination[]
  coverPhoto: string | null
  photos?: { id: string; url: string; caption: string | null }[]
  currentUserId?: string | null
  isOwn?: boolean
  isBucketed?: boolean
  saveCount: number
  bestMonths?: string[]
  durationDays?: number | null
  tags?: string[]
  datesFlexible?: boolean
  fullWidth?: boolean
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

export default function ItineraryCard({
  id, postType, title, startDate, endDate, audience, budget, tripRating, authorName, destinations, coverPhoto, photos = [],
  currentUserId, isOwn, isBucketed = false, saveCount, fullWidth = false, datesFlexible = false, bestMonths = [], tags = [], durationDays,
}: Props) {
  const days = tripDuration({ postType, startDate, endDate, datesFlexible, destinations, tags, durationDays })
  const isGuide = days === null
  const stamp = TRIP_STAMPS.find(stamp => stamp.value === tripRating)
  const coverColor = hashPick(title, COVER_COLORS)
  const avatarColor = hashPick(authorName, AVATAR_COLORS)
  const initials = getInitials(authorName)
  const tapeColor = hashPick(id, TAPE_COLORS)
  const tapeRotation = hashPick(title, TAPE_ROTATIONS)
  const season = tripSeason({ startDate, endDate, datesFlexible: !hasTripDates({ startDate, endDate, datesFlexible, postType }), postType: isGuide ? 'guide' : postType, bestMonths, latitude: destinations.find(destination => destination.lat != null)?.lat })

  function locationLabel(dests: Destination[]): string | null {
    if (dests.length === 0) return null
    if (dests.length === 1) {
      const d = dests[0]
      return `${d.name}${d.country ? `, ${d.country}` : ''}`
    }
    if (dests.length <= 3) {
      return dests.map((d) => d.name).join(' · ')
    }
    const countries = [...new Set(dests.map((d) => d.country).filter(Boolean))] as string[]
    if (countries.length === 0) return dests.map((d) => d.name).slice(0, 3).join(' · ') + '…'
    if (countries.length <= 4) return countries.join(' · ')
    return countries.slice(0, 3).join(' · ') + ` +${countries.length - 3}`
  }

  const location = locationLabel(destinations)

  const showBucket = !isOwn

  return (
    <article className={`block ${fullWidth ? 'w-full' : 'w-[clamp(200px,44vw,320px)]'} relative pt-5`}>

      {/* Tape */}
      <div
        className="pointer-events-none absolute top-1 left-1/2 z-10 w-12 h-7 rounded-[2px]"
        style={{
          backgroundColor: tapeColor,
          transform: `translateX(-50%) rotate(${tapeRotation})`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      />

      {/* Polaroid card */}
      <div
        className={`bg-white rounded-[3px] ${fullWidth ? 'px-2.5 pt-3 pb-4' : 'px-4 pt-5 pb-7'}`}
        style={{ boxShadow: '2px 5px 20px rgba(0,0,0,0.16)' }}
      >
        {/* Photo */}
        <div
          className={`relative w-full overflow-hidden ${fullWidth ? 'aspect-[6/5] mb-2.5' : 'aspect-[4/3] mb-4'}`}
          style={{ backgroundColor: coverColor }}
        >
          {fullWidth && photos.length > 0 ? <PhotoStrip photos={photos} title={title} fillContainer counterPosition="left" /> : <Link href={`/itinerary/${id}`} aria-label={`Open ${title}`} className="absolute inset-0">
            {coverPhoto && <Image src={coverPhoto} alt={title} fill sizes={fullWidth ? '(max-width: 575px) calc(100vw - 60px), 516px' : '(max-width: 727px) 44vw, 320px'} className="object-cover" />}
          </Link>}

          {/* Badge */}
          <div className="pointer-events-none absolute top-2 left-2 max-w-[45%] flex flex-col gap-1">
            {audience === 'family' && (
              <span className="text-[10px] px-2 py-1 rounded font-semibold bg-black/60 text-white">👨‍👩‍👧 Family</span>
            )}
            {audience === 'friends' && (
              <span className="text-[10px] px-2 py-1 rounded font-semibold bg-black/60 text-white">🥳 Friends</span>
            )}
            {audience === 'romantic' && (
              <span className="text-[10px] px-2 py-1 rounded font-semibold bg-black/60 text-white">💋 Romantic</span>
            )}
          </div>

          {stamp && (
            <span
              aria-label={`Author verdict: ${stamp.label}`}
              className={`pointer-events-none absolute top-2 right-2 max-w-[45%] rounded px-2 py-1 text-center text-[10px] font-bold text-white shadow-sm ${stamp.bg}`}
            >
              {stamp.label}
            </span>
          )}

          {/* Bucket button */}
          {showBucket && (
            <div className="absolute bottom-2 right-2">
              <BucketButton itineraryId={id} initialBucketed={isBucketed} isLoggedIn={!!currentUserId} />
            </div>
          )}
        </div>

        {/* Caption */}
        <Link href={`/itinerary/${id}`} className={fullWidth ? 'block px-1' : 'block'}>
          <h2 className={`${amatic.className} text-[28px] text-[#242e25] leading-tight line-clamp-2 mb-2`}>
            {title}
          </h2>

          <div className="text-xs text-[#8B6F4E] space-y-0.5">
            {location && (
              <span className="flex items-center gap-1 truncate min-w-0">
                <MapPin size={9} className="shrink-0" />
                {location}
              </span>
            )}
            {days === null && <span className="block">Guide</span>}
            {days !== null && (
              <span className="block">
                {days}-day trip
              </span>
            )}
          </div>

          {season && <p className={`${kalam.className} mt-1.5 text-right text-sm text-[#8B6F4E]`} aria-label={`${isGuide || datesFlexible ? 'Recommended season' : 'Trip season'}: ${season}`}>{season}</p>}

          <div className={`flex items-center gap-2 border-t border-[#dfd3c2] ${fullWidth ? 'mt-2 pt-2' : 'mt-3 pt-3'}`}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <span className={`${kalam.className} text-sm text-[#8B6F4E] truncate flex-1`}>
              {authorName}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span aria-label={`${saveCount} ${saveCount === 1 ? 'favorite' : 'favorites'}`} className="text-[10px] text-[#8B6F4E] flex items-center gap-0.5">
                <span aria-hidden="true">🤍</span> {saveCount}
              </span>
              {budget && budget > 0 && (
                <span className="text-[10px] font-medium tracking-tight">
                  {[1,2,3,4,5].map((n) => (
                    <span key={n} className={n <= budget ? 'text-green-600' : 'text-gray-200'}>$</span>
                  ))}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    </article>
  )
}
