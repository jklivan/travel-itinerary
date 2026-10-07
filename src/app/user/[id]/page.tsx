
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ItineraryCard from '@/components/ItineraryCard'
import UserAvatar from '@/components/UserAvatar'
import SavedFolders from '@/components/SavedFolders'
import SavedFolderPicker from '@/components/SavedFolderPicker'
import DeleteButton from '@/components/DeleteButton'
import { tripPhotoGallery } from '@/lib/eventPhotos'
import { fetchStockPhoto } from '@/lib/stockPhoto'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'
import { ChevronRight, Settings } from 'lucide-react'
import { PostStamp } from '@/components/PostcardLogo'

function destinationStockFallback(destination: string, country: string | null) {
  const query = `${destination} ${country ?? ''}`.toLowerCase()
  const photo = query.includes('paris') || query.includes('france')
    ? 'photo-1502602898657-3e91760cbb34'
    : query.includes('london') || query.includes('england') || query.includes('uk')
    ? 'photo-1513635269975-59663e0ac1ad'
    : query.includes('japan') || query.includes('kyoto')
    ? 'photo-1493976040374-85c8e12f0c0e'
    : 'photo-1500530855697-b586d89ba3ee'
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=640&q=80`
}

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; folder?: string }>
}) {
  const { id } = await params
  const { tab, folder } = await searchParams
  const session = await auth()

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, image: true, createdAt: true },
  })
  if (!user) notFound()

  const isOwn = session?.user?.id === user.id
  const viewerId = session?.user?.id ?? null
  const showBucket = isOwn && tab === 'bucket'
  const showDrafts = (tab === 'in-progress' || tab === 'drafts') && isOwn

  const [itineraries, drafts, bucketItems, followRecord, followerCount, followingCount, viewerBucketIds, folders] = await Promise.all([
    prisma.itinerary.findMany({
      where: { userId: id, visibility: { not: 'draft' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { orderBy: { isStock: 'asc' } },
        likes: { where: { userId: viewerId ?? '' }, select: { id: true }, take: 1 }, _count: { select: { likes: true, bucketedBy: true } },
      },
    }),
    isOwn
      ? prisma.itinerary.findMany({
          where: { userId: id, visibility: 'draft' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            destinations: { orderBy: { order: 'asc' }, include: { items: true } },
            photos: { orderBy: { isStock: 'asc' } },
            likes: { where: { userId: viewerId ?? '' }, select: { id: true }, take: 1 }, _count: { select: { likes: true, bucketedBy: true } },
          },
        })
      : Promise.resolve([]),
    isOwn
      ? prisma.bucketListItem.findMany({
          where: { userId: id, itinerary: { visibility: { not: 'draft' } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            itinerary: {
              include: {
                user: { select: { id: true, name: true, image: true } },
                destinations: { orderBy: { order: 'asc' }, include: { items: true } },
                photos: { orderBy: { isStock: 'asc' } },
                likes: { where: { userId: viewerId ?? '' }, select: { id: true }, take: 1 }, _count: { select: { likes: true, bucketedBy: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    session?.user?.id && !isOwn
      ? prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: session.user.id, followingId: id } },
        })
      : Promise.resolve(null),
    prisma.follow.count({ where: { followingId: id, status: 'accepted' } }),
    prisma.follow.count({ where: { followerId: id, status: 'accepted' } }),
    viewerId && !isOwn
      ? prisma.bucketListItem.findMany({ where: { userId: viewerId }, select: { itineraryId: true } })
      : Promise.resolve([]),
    isOwn
      ? prisma.savedFolder.findMany({ where: { userId: id }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ])

  const selectedFolder = folder && folders.some(f => f.id === folder) ? folder : ''
  const visibleBucketItems = bucketItems.filter(item => !selectedFolder || item.folderId === selectedFolder)

  const followStatus = followRecord?.status ?? 'none'

  const viewerBucketSet = new Set(viewerBucketIds.map((b) => b.itineraryId))
  const ownBucketSet = new Set(bucketItems.map((b) => b.itineraryId))

  // Prefer posted/item photos, then an existing stock cover, then fetch a
  // destination image so every private-plan card has a useful visual.
  const draftCoverPhotos = new Map<string, string>()
  await Promise.all((showBucket ? [] : drafts).map(async trip => {
    const itemPhoto = trip.destinations.flatMap(destination => destination.items).flatMap(item => item.photoUrls ?? (item.photoUrl ? [item.photoUrl] : [])).find(Boolean)
    const userPhoto = trip.photos.find(photo => !photo.isStock)?.url
    const existingStock = trip.photos.find(photo => photo.isStock)?.url
    if (userPhoto || itemPhoto || existingStock) {
      draftCoverPhotos.set(trip.id, userPhoto ?? itemPhoto ?? existingStock!)
      return
    }
    const destination = trip.destinations[0]
    if (!destination) return
    const fetched = await fetchStockPhoto(`${trip.title || destination.name} ${destination.name}${destination.country ? ` ${destination.country}` : ''} travel`).catch(() => null)
    draftCoverPhotos.set(trip.id, fetched ?? destinationStockFallback(destination.name, destination.country))
  }))

  return (
    <div className="max-w-xl mx-auto px-5 py-6 sm:px-8">

      {/* Public profile header */}
      {!isOwn && <div className="panel p-5 mb-5 flex items-center gap-4">
        <UserAvatar name={user.name} image={user.image} size={64} className="text-title" />
        <div className="flex-1 min-w-0">
          <h1 className="type-title">{user.name}</h1>
          {/* Same plain stats line as your own profile. */}
          <p className="mt-1 text-xs text-link">{followerCount} follower{followerCount !== 1 ? 's' : ''} · {followingCount} following · {itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwn && <Link href="/settings" aria-label="Settings" className="btn-icon"><Settings size={18} /></Link>}
        {session?.user && !isOwn && (
          <form action={async () => {
            'use server'
            if (followStatus === 'accepted') await unfollowUser(id)
            else if (followStatus === 'pending') await cancelFollowRequest(id)
            else await sendFollowRequest(id)
          }}>
            <button type="submit" aria-pressed={followStatus === 'accepted'} className="chip">
              {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : '+ Follow'}
            </button>
          </form>
        )}
      </div>}

      {!isOwn && <Link href={`/messages/${id}`} className="btn btn-primary btn-sm mb-5">Send message</Link>}

      {isOwn && !showBucket ? (
        <>
          <section aria-labelledby="your-trips-heading">
            <div><h1 id="your-trips-heading" className="type-display">Your trips</h1><Link href="/plan" className="btn btn-primary mt-4">Start planning!</Link></div>
            <section className="mt-5" aria-labelledby="private-plans-heading">
              <div className="mb-4"><h2 id="private-plans-heading" className="type-title text-brown">Private plans <span className="font-sans text-sm tracking-normal">({drafts.length})</span></h2><p className="mt-1 max-w-sm text-sm leading-snug text-muted">Only you can see these. Keep planning or publish whenever you’re ready.</p></div>
              {drafts.length === 0 ? <div className="panel-dashed p-6 text-center text-sm text-muted">No private plans yet.</div> : <div className="space-y-4">{drafts.map(trip => {
                const tripHref = `/plan/${trip.id}`
                return <article key={trip.id} className="panel grid grid-cols-[minmax(0,38%)_minmax(0,1fr)] gap-x-4 gap-y-3 p-3 shadow-card">
                  <Link href={tripHref} aria-label={`Open ${trip.title}`} className="photo-polaroid row-span-2 self-start"><span className="photo-polaroid-image">{draftCoverPhotos.get(trip.id) ? <Image src={draftCoverPhotos.get(trip.id)!} alt="" fill sizes="(max-width: 640px) 34vw, 180px" className="object-cover" /> : <span className="grid h-full place-items-center text-center text-micro uppercase tracking-wider text-link">Postcard</span>}</span></Link>
                  <Link href={tripHref} className="min-w-0 pt-2"><h3 className="type-card break-words">{trip.title || 'Untitled trip'}</h3><p className="mt-2 text-label font-semibold uppercase tracking-widest text-muted">{trip.destinations.reduce((sum, destination) => sum + destination.items.length, 0)} places</p><p className="mt-1 text-sm text-muted">Keep planning →</p></Link>
                  <div className="flex min-w-0 flex-wrap items-end justify-between gap-2 self-end">
                    <DeleteButton compact id={trip.id} visibility={trip.visibility} returnTo={`/user/${id}`} label={`Delete ${trip.title}`} />
                    <Link href={trip.isPlan ? `${tripHref}?post=1` : tripHref} aria-label={`Post ${trip.title}`} title="Post trip" className="inline-flex h-12 w-[66px] shrink-0 items-center justify-center transition-transform hover:-rotate-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"><PostStamp size={52} /></Link>
                  </div>
                </article>
              })}</div>}
            </section>

          </section>
        </>
      ) : showDrafts ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="type-label text-ink">In progress</h2><p className="mt-1 text-sm text-brown">All your unpublished trips, ready to pick up anytime.</p></div></div>
          {drafts.length === 0 ? <div className="panel p-8 text-center"><p className="text-sm text-brown">No trips in progress yet.</p><Link href="/plan" className="btn btn-primary mt-4">Start planning</Link></div> : <div className="space-y-3">
            {drafts.map(trip => <Link key={trip.id} href={`/plan/${trip.id}`} className="panel flex items-center gap-3 p-4 transition-colors hover:bg-mist">
              <span className="min-w-0 flex-1"><span className="text-xs font-semibold uppercase tracking-wide text-link">Only you · Not posted</span><span className="mt-1 block break-words font-[family-name:var(--font-playfair)] text-title text-ink">{trip.title || 'Untitled trip'}</span><span className="mt-1 block text-sm text-muted">{trip.destinations.reduce((sum, destination) => sum + destination.items.length, 0)} places · Open to keep planning</span></span><ChevronRight size={20} className="shrink-0 text-link" />
            </Link>)}
          </div>}
        </>
      ) : !showBucket ? (
        <>
          <h2 className="type-label text-ink mb-3">
            {isOwn ? 'Your itineraries' : 'Itineraries'}
          </h2>
          {itineraries.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-brown italic text-sm">No public itineraries yet.</p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:gap-5">
              {itineraries.map((it) => (
                <ItineraryCard
                  fullWidth
                  key={it.id}
                  id={it.id}
                  postType={it.postType}
              tags={it.tags}
              durationDays={it.durationDays}
                  title={it.title}
                  bestMonths={it.bestMonths}
              datesFlexible={it.datesFlexible}
                  startDate={it.startDate}
                  endDate={it.endDate}
                  audience={it.audience}
                  budget={it.budget}
                  tripRating={it.tripRating}
                  authorName={user.name}
                  authorImage={user.image}
                  authorId={user.id}
                  destinations={it.destinations}
                  coverPhoto={it.coverPhoto ?? it.photos[0]?.url ?? null}
                  photos={tripPhotoGallery(it.photos, it.destinations.flatMap(destination => destination.items), it.coverPhoto)}
                  currentUserId={viewerId}
                  isOwn={isOwn}
                  isBucketed={viewerBucketSet.has(it.id)}
                  likeCount={it._count.likes} isLiked={it.likes.length > 0}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="type-display">Saved Trips</h1>
          <p className="mb-5 mt-2 text-sm text-muted">All your saved trips and folders, ready for your next adventure.</p>
          {isOwn && <SavedFolders key={selectedFolder} userId={id} folders={folders.map(f => ({ ...f, count: bucketItems.filter(item => item.folderId === f.id).length }))} selected={selectedFolder} total={bucketItems.length} />}
          {visibleBucketItems.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-display-lg mb-3">❤️</p>
              <p className="text-brown text-sm">{selectedFolder ? 'No trips in this folder yet.' : 'Nothing saved yet.'}</p>
              <p className="text-brown text-xs mt-1">
                {selectedFolder ? 'Use Save to folder on an itinerary, or organize trips from All saved.' : 'Tap the ❤️ on any itinerary to save it.'}
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:gap-5">
              {visibleBucketItems.map((item) => (
                <div key={item.id} className="w-full min-w-0">
                  <ItineraryCard
                  fullWidth
                    id={item.itinerary.id}
                    postType={item.itinerary.postType}
                    tags={item.itinerary.tags}
                    durationDays={item.itinerary.durationDays}
                    title={item.itinerary.title}
                    bestMonths={item.itinerary.bestMonths}
                    datesFlexible={item.itinerary.datesFlexible}
                    startDate={item.itinerary.startDate}
                    endDate={item.itinerary.endDate}
                    audience={item.itinerary.audience}
                    budget={item.itinerary.budget}
                    tripRating={item.itinerary.tripRating}
                    authorName={item.itinerary.user.name}
                    authorImage={item.itinerary.user.image}
                    authorId={item.itinerary.user.id}
                    destinations={item.itinerary.destinations}
                    coverPhoto={item.itinerary.coverPhoto ?? item.itinerary.photos[0]?.url ?? null}
                    photos={tripPhotoGallery(item.itinerary.photos, item.itinerary.destinations.flatMap(destination => destination.items), item.itinerary.coverPhoto)}
                    currentUserId={viewerId}
                    isOwn={item.itinerary.user.id === viewerId}
                    isBucketed={ownBucketSet.has(item.itinerary.id)}
                    likeCount={item.itinerary._count.likes} isLiked={item.itinerary.likes.length > 0}
                  />
                  <div className="mt-3"><SavedFolderPicker itineraryId={item.itinerary.id} label={folders.find(f => f.id === item.folderId)?.name ?? 'Save to folder'} /></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
