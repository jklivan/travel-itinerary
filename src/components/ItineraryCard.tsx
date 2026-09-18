import Link from 'next/link'
import Image from 'next/image'
import { Heart, MapPin, MessageCircle } from 'lucide-react'
import { hasTripDates, tripDuration } from '@/lib/dayTrips'
import { tripSeason } from '@/lib/tripSeason'
import { TRIP_STAMPS } from '@/lib/tripStamps'
import PhotoStrip from './PhotoStrip'
import BucketButton from './BucketButton'


type DestItem = { type: string; name: string; dayIndex?: number | null }
type Destination = { lat?: number | null; name: string; country: string | null; items: DestItem[] }

type Props = {
  id: string
  postType: string
  title: string
  startDate: Date
  endDate: Date
  audience: string
  authorId?: string
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
  commentCount?: number
  showBudget?: boolean
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

export default function ItineraryCard({
  id, postType, title, startDate, endDate, audience, budget, tripRating, authorName, authorId, destinations, coverPhoto, photos = [],
  currentUserId, isOwn, isBucketed = false, saveCount, fullWidth = false, datesFlexible = false, bestMonths = [], tags = [], durationDays,
  commentCount = 0, showBudget = true,
}: Props) {
  const days = tripDuration({ postType, startDate, endDate, datesFlexible, destinations, tags, durationDays })
  const isGuide = days === null
  const stamp = TRIP_STAMPS.find(stamp => stamp.value === tripRating)
  const coverColor = hashPick(title, COVER_COLORS)
  const avatarColor = hashPick(authorName, AVATAR_COLORS)
  const initials = getInitials(authorName)
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
    <article className={`block ${fullWidth ? 'w-full' : 'w-[clamp(200px,44vw,320px)]'} relative`}>
      <div className="rounded-[4px] border border-[#e7e0d3] bg-[#fffdf8] p-2 shadow-[2px_4px_14px_rgba(45,38,27,0.16)] sm:p-2.5">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2px]" style={{ backgroundColor: coverColor }}>
          {fullWidth && photos.length > 0 ? <PhotoStrip photos={photos.map(photo => ({ ...photo, caption: null }))} title={title} fillContainer counterPosition="left" /> : <Link href={`/itinerary/${id}`} aria-label={`Open ${title}`} className="absolute inset-0">
            {coverPhoto && <Image src={coverPhoto} alt="" fill sizes={fullWidth ? '(max-width: 575px) calc(100vw - 44px), 516px' : '(max-width: 727px) 44vw, 320px'} className="object-cover" />}
          </Link>}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#17221c]/85 via-[#17221c]/15 to-transparent" />

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[55%] flex-col gap-1">
            {audience === 'family' && <span className="w-fit rounded-sm bg-[#fffdf2]/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#2e4147]">Family</span>}
            {audience === 'friends' && <span className="w-fit rounded-sm bg-[#fffdf2]/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#2e4147]">Friends</span>}
            {audience === 'romantic' && <span className="w-fit rounded-sm bg-[#fffdf2]/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#2e4147]">Romantic</span>}
          </div>

          <div aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 z-20 grid size-14 place-items-center bg-[#f6f1e7]/95 text-[#2e4147] shadow-md">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" fill="none" aria-hidden="true">
              <rect width="100" height="100" fill="#9c917e" />
              <path d="M7 4h4l3 5 3-5h6l3 5 3-5h6l3 5 3-5h6l3 5 3-5h6l3 5 3-5h6l3 5 3-5h6l3 5 3-5h6l3 5 3-5h5v5l-5 3 5 3v6l-5 3 5 3v6l-5 3 5 3v6l-5 3 5 3v6l-5 3 5 3v6l-5 3 5 3v6l-5 3 5 3v6l-5 3 5 3v5h-5l-3-5-3 5h-6l-3-5-3 5h-6l-3-5-3 5h-6l-3-5-3 5h-6l-3-5-3 5h-6l-3-5-3 5h-6l-3-5-3 5h-6l-3-5-3 5h-6l-3-5-3 5H7v-5l5-3-5-3v-6l5-3-5-3v-6l5-3-5-3v-6l5-3-5-3v-6l5-3-5-3v-6l5-3-5-3v-6l5-3-5-3v-6l5-3-5-3z" fill="#f6f1e7" />
              <rect x="15" y="15" width="70" height="70" stroke="#ffffff" strokeWidth="2" />
            </svg>
            <span className="relative z-10 flex items-center gap-0.5 font-[family-name:var(--font-playfair)] text-[29px] leading-none">P
              <svg viewBox="0 0 34 22" className="h-5 w-7 text-[#8b6f4e]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 5c6-4 10 4 16 0s10 4 14 0M2 11c6-4 10 4 16 0s10 4 14 0M2 17c6-4 10 4 16 0s10 4 14 0" /></svg>
            </span>
          </div>

          <Link href={`/itinerary/${id}`} className="absolute inset-x-3 bottom-3 z-10 block max-w-[76%] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] sm:inset-x-5 sm:bottom-4">
            {location && <span className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/90 sm:text-[10px]">
              <MapPin size={11} className="shrink-0" />{location}
            </span>}
            <h2 className="trip-title line-clamp-2 font-[family-name:var(--font-playfair)] text-xl leading-[1.08] sm:text-2xl">{title}</h2>
            <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.14em] text-white/85">{days === null ? 'Guide' : `${days}-day trip`}</span>
          </Link>

          {stamp && <span aria-label={`Author verdict: ${stamp.label}`} className={`pointer-events-none absolute bottom-3 right-3 z-20 -rotate-3 border border-dashed border-white/80 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm sm:bottom-4 sm:right-4 ${stamp.bg}`}>
            {stamp.label}
          </span>}
        </div>

        <div className={`flex min-h-10 items-center justify-between gap-2 px-1 pt-2 ${fullWidth ? 'sm:px-1.5' : ''}`}>
          {authorId ? <Link href={`/user/${authorId}`} className="flex min-w-0 items-center gap-2 hover:opacity-80">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ backgroundColor: avatarColor }}>{initials}</span>
            <span className="truncate text-[10px] font-medium lowercase text-[#667069]">{authorName}</span>
          </Link> : <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ backgroundColor: avatarColor }}>{initials}</span>
            <span className="truncate text-[10px] font-medium lowercase text-[#667069]">{authorName}</span>
          </div>}
          <div className="flex shrink-0 items-center gap-2.5 text-[#667069]">
            {season && <span className="hidden text-[8px] font-medium uppercase tracking-[0.12em] text-[#8B6F4E] min-[390px]:inline">{season}</span>}
            {showBucket && <BucketButton itineraryId={id} initialBucketed={isBucketed} isLoggedIn={!!currentUserId} />}
            <span aria-label={`${saveCount} likes`} className="flex items-center gap-0.5 text-[10px]"><Heart size={13} />{saveCount}</span>
            <Link href={`/itinerary/${id}#comments`} aria-label={`${commentCount} comments`} className="flex min-h-8 items-center gap-0.5 text-[10px] hover:text-[#2e4147]">
              <MessageCircle size={13} />{commentCount}
            </Link>
            {showBudget && budget && budget > 0 && <span className="text-[9px] font-medium tracking-tight" aria-label={`Budget level ${budget} out of 5`}>
              {[1,2,3,4,5].map((n) => <span key={n} className={n <= budget ? 'text-green-600' : 'text-gray-300'}>$</span>)}
            </span>}
          </div>
        </div>
      </div>
    </article>
  )
}
