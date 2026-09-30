import Link from 'next/link'
import Image from 'next/image'
import { Heart, MapPin, MessageCircle } from 'lucide-react'
import { hasTripDates, tripDuration } from '@/lib/dayTrips'
import { tripSeason } from '@/lib/tripSeason'
import { TRIP_STAMPS, STAMP_COLORS } from '@/lib/tripStamps'
import PhotoStrip from './PhotoStrip'
import BucketButton from './BucketButton'
import UserAvatar from './UserAvatar'


const AUDIENCE_CHIP = 'w-fit rounded-md bg-cream/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink'

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
  authorImage?: string | null
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
function hashPick(str: string, arr: string[]) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return arr[Math.abs(h) % arr.length]
}


export default function ItineraryCard({
  id, postType, title, startDate, endDate, audience, budget, tripRating, authorName, authorImage, authorId, destinations, coverPhoto, photos = [],
  currentUserId, isOwn, isBucketed = false, saveCount, fullWidth = false, datesFlexible = false, bestMonths = [], tags = [], durationDays,
  // Budget shows on the trip page, not on cards.
  commentCount = 0, showBudget = false,
}: Props) {
  const days = tripDuration({ postType, startDate, endDate, datesFlexible, destinations, tags, durationDays })
  const isGuide = days === null
  const stamp = TRIP_STAMPS.find(stamp => stamp.value === tripRating)
  const coverColor = hashPick(title, COVER_COLORS)
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
      <div className="rounded-md border border-line-soft bg-card p-2.5 shadow-[0_4px_16px_rgba(31,51,84,0.09)] sm:p-3">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2px]" style={{ backgroundColor: coverColor }}>
          {fullWidth && photos.length > 0 ? <PhotoStrip href={`/itinerary/${id}`} photos={photos.map(photo => ({ ...photo, caption: null }))} title={title} fillContainer counterPosition="left" /> : <Link href={`/itinerary/${id}`} aria-label={`Open ${title}`} className="absolute inset-0">
            {coverPhoto && <Image src={coverPhoto} alt="" fill sizes={fullWidth ? '(max-width: 575px) calc(100vw - 44px), 516px' : '(max-width: 727px) 44vw, 320px'} className="object-cover" />}
          </Link>}

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[55%] flex-col gap-1">
            {audience === 'family' && <span className={AUDIENCE_CHIP}>Family</span>}
            {audience === 'friends' && <span className={AUDIENCE_CHIP}>Friends</span>}
            {audience === 'romantic' && <span className={AUDIENCE_CHIP}>Couples</span>}
          </div>

          {/* The Postcard stamp, on a white disc so it reads on dark photos. */}
          <div aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 z-20 size-[64px] rotate-[8deg] rounded-full bg-white/95 p-0.5 shadow-md">
            <Image src="/brand/postcard-stamp-logo.png" alt="" width={60} height={60} className="size-full" />
          </div>
        </div>

        {/* Place, title and length sit on the paper under the photo; the verdict is a postage stamp beside them. */}
        <div className="relative px-1 pt-3">
          <Link href={`/itinerary/${id}`} className={`block text-ink ${stamp ? 'pr-24' : ''}`}>
            {location && <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-link">
              <MapPin size={12} className="shrink-0 text-brown" />{location}
            </span>}
            <h2 className="trip-title line-clamp-2 font-[family-name:var(--font-playfair)] text-xl !uppercase leading-[1.1] tracking-[0.08em] sm:text-2xl">{title}</h2>
            <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-link">{days === null ? 'Guide' : `${days}-day trip`}</span>
          </Link>
          {stamp && <span aria-label={`Author verdict: ${stamp.label}`} className="pointer-events-none absolute -top-5 right-0 z-20 -rotate-[12deg] p-[3px] shadow-md" style={{ backgroundColor: STAMP_COLORS[stamp.value] }}>
            <span className="block border border-dashed border-white/70 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white">{stamp.label}</span>
          </span>}
        </div>

        <div className={`mt-2 flex min-h-11 items-center justify-between gap-2 border-t border-line-soft px-1 pt-2 ${fullWidth ? 'sm:px-1.5' : ''}`}>
          {authorId ? <Link href={`/user/${authorId}`} className="flex min-w-0 items-center gap-2 hover:opacity-80">
            <UserAvatar name={authorName} image={authorImage} size={32} />
            <span className="truncate font-[family-name:var(--font-playfair)] text-[11px] uppercase tracking-[0.18em] text-link">{authorName}</span>
          </Link> : <div className="flex min-w-0 items-center gap-2">
            <UserAvatar name={authorName} image={authorImage} size={32} />
            <span className="truncate font-[family-name:var(--font-playfair)] text-[11px] uppercase tracking-[0.18em] text-link">{authorName}</span>
          </div>}
          <div className="flex shrink-0 items-center gap-2.5 text-ink">
            {season && <span className="hidden text-[8px] font-medium uppercase tracking-[0.12em] text-brown min-[390px]:inline">{season}</span>}
            {showBucket && <BucketButton itineraryId={id} initialBucketed={isBucketed} isLoggedIn={!!currentUserId} withFolders={!!currentUserId} />}
            <span aria-label={`${saveCount} likes`} className="flex items-center gap-1 text-[11px]"><Heart size={15} />{saveCount}</span>
            <Link href={`/itinerary/${id}#comments`} aria-label={`${commentCount} comments`} className="flex min-h-8 items-center gap-1 text-[11px] hover:text-link">
              <MessageCircle size={15} />{commentCount}
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
