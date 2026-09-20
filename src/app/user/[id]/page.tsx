
import BackButton from '@/components/BackButton'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ItineraryCard from '@/components/ItineraryCard'
import SavedFolders from '@/components/SavedFolders'
import SavedFolderPicker from '@/components/SavedFolderPicker'
import DeleteButton from '@/components/DeleteButton'
import { tripPhotoGallery } from '@/lib/eventPhotos'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'
import { MapPin, Users, ChevronRight, Settings } from 'lucide-react'

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F59E0B', '#EF4444', '#10B981', '#3B82F6',
]
function hashPick(str: string, arr: string[]) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return arr[Math.abs(h) % arr.length]
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
    select: { id: true, name: true, createdAt: true },
  })
  if (!user) notFound()

  const isOwn = session?.user?.id === user.id
  const viewerId = session?.user?.id ?? null
  const showBucket = tab === 'bucket'
  const showDrafts = (tab === 'in-progress' || tab === 'drafts') && isOwn

  const [itineraries, drafts, bucketItems, followRecord, followerCount, followingCount, viewerBucketIds, folders, pendingCount] = await Promise.all([
    prisma.itinerary.findMany({
      where: { userId: id, visibility: { not: 'draft' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { orderBy: { isStock: 'asc' } },
        _count: { select: { bucketedBy: true } },
      },
    }),
    isOwn
      ? prisma.itinerary.findMany({
          where: { userId: id, visibility: 'draft' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            destinations: { orderBy: { order: 'asc' }, include: { items: true } },
            photos: { orderBy: { isStock: 'asc' } },
            _count: { select: { bucketedBy: true } },
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
                user: { select: { id: true, name: true } },
                destinations: { orderBy: { order: 'asc' }, include: { items: true } },
                photos: { orderBy: { isStock: 'asc' } },
                _count: { select: { bucketedBy: true } },
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
    isOwn ? prisma.follow.count({ where: { followingId: id, status: 'pending' } }) : Promise.resolve(0),
  ])

  const selectedFolder = folder && folders.some(f => f.id === folder) ? folder : ''
  const visibleBucketItems = bucketItems.filter(item => !selectedFolder || item.folderId === selectedFolder)

  const followStatus = followRecord?.status ?? 'none'
  const avatarColor = hashPick(user.name, AVATAR_COLORS)
  const initials = getInitials(user.name)

  const viewerBucketSet = new Set(viewerBucketIds.map((b) => b.itineraryId))
  const ownBucketSet = new Set(bucketItems.map((b) => b.itineraryId))

  return (
    <div className="max-w-xl mx-auto px-5 py-6 sm:px-8">
      {!isOwn && <BackButton fallback="/friends" className="text-sm text-[#8B6F4E] hover:underline mb-5 inline-block">← Back</BackButton>}

      {/* Public profile header */}
      {!isOwn && <div className="bg-[#faf7f1] rounded-xl border border-[#dfd3c2] p-5 mb-5 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-[family-name:var(--font-playfair)] text-xl text-[#242e25]">{user.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-[#8B6F4E]">
            <span className="flex items-center gap-1">
              <Users size={12} />
              {followerCount} follower{followerCount !== 1 ? 's' : ''}
            </span>
            <span>{followingCount} following</span>
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {itineraries.length} trip{itineraries.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {isOwn && <Link href="/settings" aria-label="Settings" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#dfd3c2] text-[#59694f] hover:bg-[#e9e3d7]"><Settings size={18} /></Link>}
        {session?.user && !isOwn && (
          <form action={async () => {
            'use server'
            if (followStatus === 'accepted') await unfollowUser(id)
            else if (followStatus === 'pending') await cancelFollowRequest(id)
            else await sendFollowRequest(id)
          }}>
            <button type="submit"
              className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                followStatus === 'accepted'
                  ? 'border-[#c1ad93] text-[#485340] hover:border-red-300 hover:text-red-500'
                  : followStatus === 'pending'
                  ? 'border-amber-300 text-amber-700 hover:border-red-300 hover:text-red-500'
                  : 'bg-[#242e25] border-[#242e25] text-white hover:bg-[#485340]'
              }`}>
              {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : '+ Follow'}
            </button>
          </form>
        )}
      </div>}

      {!isOwn && <Link href="/friends" className="group mb-5 flex min-h-20 items-center gap-4 rounded-2xl border border-[#c7d7cf] bg-[#edf1e9] p-4 text-[#2e4147] transition-colors hover:bg-[#e3ebe0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#59694f]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#59694f]/10 text-[#59694f]"><Users size={23} /></span>
        <span className="min-w-0 flex-1"><span className="block font-[family-name:var(--font-playfair)] text-xl">Friends</span><span className="mt-0.5 block text-sm text-[#59694f]">{pendingCount ? `${pendingCount} friend request${pendingCount === 1 ? '' : 's'} waiting` : 'Find friends & see who you follow'}</span></span>
        {pendingCount > 0 && <span className="rounded-full bg-[#59694f] px-2 py-1 text-xs font-semibold text-white">{pendingCount}</span>}
        <ChevronRight size={20} className="shrink-0 text-[#59694f] transition-transform group-hover:translate-x-0.5" />
      </Link>}

      {!isOwn && <Link href={`/messages/${id}`} className="mb-5 inline-block rounded-full bg-[#59694f] px-4 py-2 text-sm text-white">Send private message</Link>}

      {isOwn ? (
        <>
          <section aria-labelledby="your-trips-heading">
            <h1 id="your-trips-heading" className="font-[family-name:var(--font-playfair)] text-3xl uppercase tracking-[0.08em] text-[#2e4147]">Your trips</h1>
            <section className="mt-5" aria-labelledby="private-plans-heading">
              <div className="mb-4"><h2 id="private-plans-heading" className="font-[family-name:var(--font-playfair)] text-xl uppercase tracking-[0.1em] text-[#9a7358]">Private plans <span className="font-sans text-sm tracking-normal">({drafts.length})</span></h2><p className="mt-1 max-w-sm text-sm leading-snug text-[#73786d]">Only you can see these. Keep planning or publish whenever you’re ready.</p></div>
              {drafts.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d7cebc] p-6 text-center text-sm text-[#73786d]">No private plans yet.</div> : <div className="space-y-4">{drafts.map(trip => <div key={trip.id} className="flex items-center gap-3 rounded-2xl border border-[#e1d8c9] bg-[#fffdf7] p-3 shadow-[0_2px_8px_rgba(45,38,27,0.08)]"><Link href={trip.isPlan ? `/plan/${trip.id}` : `/itinerary/${trip.id}/edit`} className="flex min-w-0 flex-1 items-center gap-4"><span className="relative size-[6.4rem] shrink-0 rotate-[-4deg] overflow-hidden border-[5px] border-white bg-[#e8eee8] shadow-[0_2px_4px_rgba(45,38,27,0.18)]">{trip.photos[0]?.url ? <Image src={trip.photos[0].url} alt="" fill sizes="102px" className="object-cover" /> : <span className="grid h-full place-items-center text-center text-[9px] uppercase tracking-wider text-[#59694f]">Postcard</span>}</span><span className="min-w-0"><span className="block break-words font-[family-name:var(--font-playfair)] text-lg leading-tight text-[#2e4147]">{trip.title || 'Untitled trip'}</span><span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#73786d]">{trip.destinations.reduce((sum, destination) => sum + destination.items.length, 0)} places</span><span className="mt-1 block text-sm text-[#73786d]">Keep planning →</span></span></Link><DeleteButton id={trip.id} visibility={trip.visibility} returnTo={`/user/${id}`} label="Delete trip" /></div>)}</div>}
            </section>
            <section className="mt-8" aria-labelledby="shared-trips-heading">
              <div className="mb-3"><h2 id="shared-trips-heading" className="font-[family-name:var(--font-playfair)] text-xl uppercase tracking-wide text-[#8B6F4E]">Shared trips <span className="font-sans text-sm">({itineraries.length})</span></h2><p className="mt-1 text-sm text-[#73786d]">Trips you’ve published for others to explore.</p></div>
              {itineraries.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d7cebc] p-6 text-center text-sm text-[#73786d]">No shared trips yet.</div> : <div className="space-y-4">{itineraries.map(it => <ItineraryCard fullWidth key={it.id} id={it.id} postType={it.postType} tags={it.tags} durationDays={it.durationDays} title={it.title} bestMonths={it.bestMonths} datesFlexible={it.datesFlexible} startDate={it.startDate} endDate={it.endDate} audience={it.audience} budget={it.budget} tripRating={it.tripRating} authorName={user.name} authorId={user.id} destinations={it.destinations} coverPhoto={it.photos[0]?.url ?? null} photos={tripPhotoGallery(it.photos, it.destinations.flatMap(destination => destination.items))} currentUserId={viewerId} isOwn isBucketed={ownBucketSet.has(it.id)} saveCount={it._count.bucketedBy} />)}</div>}
            </section>
          </section>
        </>
      ) : showDrafts ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold text-[#242e25]">In progress</h2><p className="mt-1 text-sm text-[#8B6F4E]">All your unpublished trips, ready to pick up anytime.</p></div></div>
          {drafts.length === 0 ? <div className="rounded-xl border border-[#dfd3c2] bg-[#faf7f1] p-8 text-center"><p className="text-sm text-[#8B6F4E]">No trips in progress yet.</p><Link href="/plan" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#242e25] px-5 text-sm font-semibold text-white">Start planning</Link></div> : <div className="space-y-3">
            {drafts.map(trip => <Link key={trip.id} href={trip.isPlan ? `/plan/${trip.id}` : `/itinerary/${trip.id}/edit`} className="flex items-center gap-3 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4 transition-colors hover:bg-[#edf1e9]">
              <span className="min-w-0 flex-1"><span className="text-xs font-semibold uppercase tracking-wide text-[#59694f]">Only you · Not posted</span><span className="mt-1 block break-words font-[family-name:var(--font-playfair)] text-xl text-[#2e4147]">{trip.title || 'Untitled trip'}</span><span className="mt-1 block text-sm text-[#73786d]">{trip.destinations.reduce((sum, destination) => sum + destination.items.length, 0)} places · Open to keep planning</span></span><ChevronRight size={20} className="shrink-0 text-[#59694f]" />
            </Link>)}
          </div>}
        </>
      ) : !showBucket ? (
        <>
          <h2 className="font-semibold text-[#242e25] text-sm mb-3">
            {isOwn ? 'Your itineraries' : 'Itineraries'}
          </h2>
          {itineraries.length === 0 ? (
            <div className="bg-[#faf7f1] rounded-xl border border-[#dfd3c2] p-8 text-center">
              <p className="text-[#8B6F4E] italic text-sm">No public itineraries yet.</p>
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
                  authorId={user.id}
                  destinations={it.destinations}
                  coverPhoto={it.photos[0]?.url ?? null}
                  photos={tripPhotoGallery(it.photos, it.destinations.flatMap(destination => destination.items))}
                  currentUserId={viewerId}
                  isOwn={isOwn}
                  isBucketed={viewerBucketSet.has(it.id)}
                  saveCount={it._count.bucketedBy}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="font-semibold text-[#242e25] text-sm mb-3 flex items-center gap-2">
            <span>❤️</span> {folders.find(f => f.id === selectedFolder)?.name ?? 'Saved'}
          </h2>
          {isOwn && <SavedFolders key={selectedFolder} userId={id} folders={folders.map(f => ({ ...f, count: bucketItems.filter(item => item.folderId === f.id).length }))} selected={selectedFolder} total={bucketItems.length} />}
          {visibleBucketItems.length === 0 ? (
            <div className="bg-[#faf7f1] rounded-xl border border-[#dfd3c2] p-8 text-center">
              <p className="text-4xl mb-3">❤️</p>
              <p className="text-[#8B6F4E] text-sm">{selectedFolder ? 'No trips in this folder yet.' : 'Nothing saved yet.'}</p>
              <p className="text-[#8B6F4E] text-xs mt-1">
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
                    authorId={item.itinerary.user.id}
                    destinations={item.itinerary.destinations}
                    coverPhoto={item.itinerary.photos[0]?.url ?? null}
                    photos={tripPhotoGallery(item.itinerary.photos, item.itinerary.destinations.flatMap(destination => destination.items))}
                    currentUserId={viewerId}
                    isOwn={item.itinerary.user.id === viewerId}
                    isBucketed={ownBucketSet.has(item.itinerary.id)}
                    saveCount={item.itinerary._count.bucketedBy}
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
