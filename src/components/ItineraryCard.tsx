import Link from 'next/link'
import Image from 'next/image'
import { Heart, MapPin } from 'lucide-react'
import CommentsSheetButton from './CommentsSheet'
import LikeButton from './LikeButton'
import { tripLocationLabel } from '@/lib/tripLocation'
import LikesSheetButton from './LikesSheet'
import { hasTripDates, tripDuration } from '@/lib/dayTrips'
import { tripSeason } from '@/lib/tripSeason'
import { TRIP_STAMPS, STAMP_COLORS } from '@/lib/tripStamps'
import Stamp from '@/components/ui/Stamp'
import PhotoStrip from './PhotoStrip'
import BucketButton from './BucketButton'
import UserAvatar from './UserAvatar'
import PostcardLogo from '@/components/PostcardLogo'
import CardPlacePhoto from './CardPlacePhoto'
import { sizedPhoto } from '@/lib/photoSizing'


const AUDIENCE_CHIP = 'w-fit rounded-lg bg-cream/95 px-2.5 py-1 text-label font-medium uppercase tracking-label text-ink'

type DestItem = { id?: string; type: string; name: string; dayIndex?: number | null }
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
  likeCount: number
  isLiked?: boolean
  bestMonths?: string[]
  durationDays?: number | null
  tags?: string[]
  datesFlexible?: boolean
  fullWidth?: boolean
  commentCount?: number
  // Feed only: a friend who liked it, and one comment to preview.
  social?: { likedBy: { id: string; name: string } | null; comment: { userId: string; name: string; text: string } | null }
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
  currentUserId, isOwn, isBucketed = false, likeCount, isLiked = false, fullWidth = false, datesFlexible = false, bestMonths = [], tags = [], durationDays,
  // Budget shows on the trip page, not on cards.
  commentCount = 0, showBudget = false, social,
}: Props) {
  const days = tripDuration({ postType, startDate, endDate, datesFlexible, destinations, tags, durationDays })
  const isGuide = days === null
  const stamp = TRIP_STAMPS.find(stamp => stamp.value === tripRating)
  const coverColor = hashPick(title, COVER_COLORS)
  // The picture: the chosen cover, else any photo on the trip (trip or place photos), else a Google photo of
  // one of its places. The colour only shows when none of those exist.
  const cover = coverPhoto ?? photos[0]?.url ?? null
  const placeIds = cover ? [] : destinations.flatMap(destination => destination.items).flatMap(item => item.id ? [item.id] : []).slice(0, 4)
  const season = tripSeason({ startDate, endDate, datesFlexible: !hasTripDates({ startDate, endDate, datesFlexible, postType }), postType: isGuide ? 'guide' : postType, bestMonths, latitude: destinations.find(destination => destination.lat != null)?.lat })

  const location = tripLocationLabel(destinations)

  const showBucket = !isOwn

  return (
    <article className={`block ${fullWidth ? 'w-full' : 'w-[clamp(200px,44vw,320px)]'} relative`}>
      <div className="rounded-lg border border-line-soft bg-card p-2.5 shadow-card sm:p-3">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg" style={{ backgroundColor: coverColor }}>
          {fullWidth && photos.length > 0 ? <PhotoStrip href={`/itinerary/${id}`} photos={photos.map(photo => ({ ...photo, caption: null }))} title={title} fillContainer counterPosition="left" /> : <Link href={`/itinerary/${id}`} aria-label={`Open ${title}`} className="absolute inset-0">
            {!cover && placeIds.length > 0 && <CardPlacePhoto itemIds={placeIds} />}
            {/* Photos from other sites (e.g. a place photo saved from Google) can't go through image resizing. */}
            {cover && (sizedPhoto(cover, 640) !== cover
              ? <Image src={cover} alt="" fill sizes={fullWidth ? '(max-width: 575px) calc(100vw - 44px), 516px' : '(max-width: 727px) 44vw, 320px'} className="object-cover" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />)}
          </Link>}

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[55%] flex-col gap-1">
            {audience === 'family' && <span className={AUDIENCE_CHIP}>Family</span>}
            {audience === 'friends' && <span className={AUDIENCE_CHIP}>Friends</span>}
            {audience === 'romantic' && <span className={AUDIENCE_CHIP}>Couples</span>}
          </div>

          {/* The Postcard stamp, on a white square (its own shape) so it reads on dark photos. */}
          <div aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 z-20 size-[64px] rotate-[8deg] rounded-lg bg-white/95 p-1 shadow-card">
            <PostcardLogo size={60} className="size-full" />
          </div>
        </div>

        {/* Place, title and length sit on the paper under the photo; the verdict is a postage stamp beside them. */}
        <div className="relative px-1 pt-3">
          <Link href={`/itinerary/${id}`} className={`block text-ink ${stamp ? 'pr-24' : ''}`}>
            {location && <span className="mb-1 flex items-center gap-1 text-label font-medium uppercase tracking-label text-link">
              <MapPin size={12} className="shrink-0 text-brown" />{location}
            </span>}
            <h2 className="trip-title break-words font-[family-name:var(--font-playfair)] text-title !uppercase leading-[1.1] tracking-caps sm:text-title">{title}</h2>
            <span className="mt-1 block text-label font-medium uppercase tracking-label text-link">{days === null ? 'Guide' : `${days}-day trip`}</span>
          </Link>
          {stamp && <Stamp aria-label={`Author verdict: ${stamp.label}`} label={stamp.label} color={STAMP_COLORS[stamp.value]} className="pointer-events-none absolute -top-5 right-0 z-20 -rotate-[12deg]" />}
        </div>

        <div className={`mt-2 flex min-h-11 items-center justify-between gap-2 border-t border-line-soft px-1 pt-2 ${fullWidth ? 'sm:px-1.5' : ''}`}>
          {authorId ? <Link href={`/user/${authorId}`} className="flex min-w-0 items-center gap-2 hover:opacity-80">
            <UserAvatar name={authorName} image={authorImage} size={32} />
            <span className="truncate font-[family-name:var(--font-playfair)] text-label uppercase tracking-label text-link">{authorName}</span>
          </Link> : <div className="flex min-w-0 items-center gap-2">
            <UserAvatar name={authorName} image={authorImage} size={32} />
            <span className="truncate font-[family-name:var(--font-playfair)] text-label uppercase tracking-label text-link">{authorName}</span>
          </div>}
          <div className="flex shrink-0 items-center gap-2.5 text-ink">
            {season && <span className="hidden text-micro font-medium uppercase tracking-widest text-brown min-[390px]:inline">{season}</span>}
            {/* One heart (like, with its count), then the bookmark (save to your folders). */}
            {/* Your own trip: just how many likes it has (you can't like your own trip). */}
            {isOwn ? likeCount ? <span className="flex min-h-8 items-center gap-1 text-label" aria-label={`${likeCount} ${likeCount === 1 ? 'like' : 'likes'}`}><Heart size={16} />{likeCount}</span> : null
              : <LikeButton itineraryId={id} initialLiked={isLiked} initialCount={likeCount} isLoggedIn={!!currentUserId} />}
            {showBucket && <BucketButton itineraryId={id} initialBucketed={isBucketed} isLoggedIn={!!currentUserId} withFolders={!!currentUserId} />}
            <CommentsSheetButton itineraryId={id} title={title} count={commentCount} variant="icon" />
            {showBudget && budget && budget > 0 && <span className="text-micro font-medium tracking-tight" aria-label={`Budget level ${budget} out of 5`}>
              {[1,2,3,4,5].map((n) => <span key={n} className={n <= budget ? 'text-ink' : 'text-gold-faint'}>$</span>)}
            </span>}
          </div>
        </div>
        {social && (likeCount > 0 || social.comment) && <div className="space-y-0.5 px-1 pt-2 text-sm leading-snug text-ink-soft">
          {/* Names go to that person's profile; "N others" / "N likes" open who liked it. */}
          {likeCount > 0 && <p>{social.likedBy
            ? <>Liked by <Link href={`/user/${social.likedBy.id}`} className="font-semibold text-ink hover:underline">{social.likedBy.name.split(' ')[0]}</Link>{likeCount > 1 && <> and <LikesSheetButton itineraryId={id} title={title}>{likeCount - 1} {likeCount - 1 === 1 ? 'other' : 'others'}</LikesSheetButton></>}</>
            : <LikesSheetButton itineraryId={id} title={title}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</LikesSheetButton>}</p>}
          {social.comment && <p className="line-clamp-1"><Link href={`/user/${social.comment.userId}`} className="font-semibold text-ink hover:underline">{social.comment.name.split(' ')[0]}</Link> {social.comment.text}</p>}
          {commentCount > 1 && <CommentsSheetButton itineraryId={id} title={title} count={commentCount} variant="link" />}
        </div>}
      </div>
    </article>
  )
}
