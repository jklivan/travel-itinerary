import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ItineraryCard from '@/components/ItineraryCard'
import HorizontalScrollFeed from '@/components/HorizontalScrollFeed'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'
import { MapPin, Users } from 'lucide-react'

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
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const session = await auth()

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, createdAt: true },
  })
  if (!user) notFound()

  const isOwn = session?.user?.id === user.id
  const viewerId = session?.user?.id ?? null
  const showBucket = tab === 'bucket'
  const showDrafts = tab === 'drafts' && isOwn

  const [itineraries, drafts, bucketItems, followRecord, followerCount, followingCount, viewerBucketIds] = await Promise.all([
    prisma.itinerary.findMany({
      where: { userId: id, visibility: { not: 'draft' } },
      orderBy: { createdAt: 'desc' },
      include: {
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { take: 1, orderBy: { isStock: 'asc' } },
        _count: { select: { bucketedBy: true } },
      },
    }),
    isOwn
      ? prisma.itinerary.findMany({
          where: { userId: id, visibility: 'draft' },
          orderBy: { createdAt: 'desc' },
          include: {
            destinations: { orderBy: { order: 'asc' }, include: { items: true } },
            photos: { take: 1, orderBy: { isStock: 'asc' } },
            _count: { select: { bucketedBy: true } },
          },
        })
      : Promise.resolve([]),
    isOwn
      ? prisma.bucketListItem.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          include: {
            itinerary: {
              include: {
                user: { select: { id: true, name: true } },
                destinations: { orderBy: { order: 'asc' }, include: { items: true } },
                photos: { take: 1, orderBy: { isStock: 'asc' } },
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
  ])

  const followStatus = followRecord?.status ?? 'none'
  const avatarColor = hashPick(user.name, AVATAR_COLORS)
  const initials = getInitials(user.name)

  const viewerBucketSet = new Set(viewerBucketIds.map((b) => b.itineraryId))
  const ownBucketSet = new Set(bucketItems.map((b) => b.itineraryId))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/friends" className="text-sm text-[#8B6F4E] hover:underline mb-5 inline-block">
        ← Friends
      </Link>

      {/* Profile header */}
      <div className="bg-[#FAF7F2] rounded-xl border border-[#E8D5B7] p-5 mb-5 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-[family-name:var(--font-playfair)] text-xl text-[#2C1810]">{user.name}</h1>
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
                  ? 'border-[#C4A882] text-[#5C3D2E] hover:border-red-300 hover:text-red-500'
                  : followStatus === 'pending'
                  ? 'border-amber-300 text-amber-700 hover:border-red-300 hover:text-red-500'
                  : 'bg-[#2C1810] border-[#2C1810] text-white hover:bg-[#5C3D2E]'
              }`}>
              {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : '+ Follow'}
            </button>
          </form>
        )}
      </div>

      {/* Tabs */}
      {isOwn && (
        <div className="flex gap-1 bg-[#FAF7F2] rounded-xl p-1 text-sm font-medium border border-[#E8D5B7] mb-5 w-fit">
          <Link
            href={`/user/${id}`}
            className={`px-4 py-1.5 rounded-lg transition-colors ${
              !showBucket && !showDrafts ? 'bg-[#2C1810] text-white shadow-sm' : 'text-[#8B6F4E] hover:text-[#2C1810]'
            }`}
          >
            My Posts
          </Link>
          <Link
            href={`/user/${id}?tab=bucket`}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              showBucket ? 'bg-red-500 text-white shadow-sm' : 'text-[#8B6F4E] hover:text-[#2C1810]'
            }`}
          >
            <span>❤️</span> Saved
            {bucketItems.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                showBucket ? 'bg-red-400 text-white' : 'bg-[#E8D5B7] text-[#5C3D2E]'
              }`}>
                {bucketItems.length}
              </span>
            )}
          </Link>
          <Link
            href={`/user/${id}?tab=drafts`}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              showDrafts ? 'bg-amber-500 text-white shadow-sm' : 'text-[#8B6F4E] hover:text-[#2C1810]'
            }`}
          >
            Drafts
            {drafts.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                showDrafts ? 'bg-amber-400 text-white' : 'bg-[#E8D5B7] text-[#5C3D2E]'
              }`}>
                {drafts.length}
              </span>
            )}
          </Link>
        </div>
      )}

      {showDrafts ? (
        <>
          <h2 className="font-semibold text-[#2C1810] text-sm mb-3">Drafts</h2>
          {drafts.length === 0 ? (
            <div className="bg-[#FAF7F2] rounded-xl border border-[#E8D5B7] p-8 text-center">
              <p className="text-[#8B6F4E] italic text-sm">No drafts yet.</p>
            </div>
          ) : (
            <HorizontalScrollFeed>
              {drafts.map((it) => (
                <ItineraryCard
                  key={it.id}
                  id={it.id}
                  postType={it.postType}
                  title={it.title}
                  startDate={it.startDate}
                  endDate={it.endDate}
                  audience={it.audience}
                  budget={it.budget}
                  authorName={user.name}
                  destinations={it.destinations}
                  coverPhoto={it.photos[0]?.url ?? null}
                  currentUserId={viewerId}
                  isOwn={true}
                  saveCount={it._count.bucketedBy}
                />
              ))}
            </HorizontalScrollFeed>
          )}
        </>
      ) : !showBucket ? (
        <>
          <h2 className="font-semibold text-[#2C1810] text-sm mb-3">
            {isOwn ? 'Your itineraries' : 'Itineraries'}
          </h2>
          {itineraries.length === 0 ? (
            <div className="bg-[#FAF7F2] rounded-xl border border-[#E8D5B7] p-8 text-center">
              <p className="text-[#8B6F4E] italic text-sm">No public itineraries yet.</p>
            </div>
          ) : (
            <HorizontalScrollFeed>
              {itineraries.map((it) => (
                <ItineraryCard
                  key={it.id}
                  id={it.id}
                  title={it.title}
                  startDate={it.startDate}
                  endDate={it.endDate}
                  audience={it.audience}
                  budget={it.budget}
                  authorName={user.name}
                  destinations={it.destinations}
                  coverPhoto={it.photos[0]?.url ?? null}
                  currentUserId={viewerId}
                  isOwn={isOwn}
                  isBucketed={viewerBucketSet.has(it.id)}
                  saveCount={it._count.bucketedBy}
                />
              ))}
            </HorizontalScrollFeed>
          )}
        </>
      ) : (
        <>
          <h2 className="font-semibold text-[#2C1810] text-sm mb-3 flex items-center gap-2">
            <span>❤️</span> Saved
          </h2>
          {bucketItems.length === 0 ? (
            <div className="bg-[#FAF7F2] rounded-xl border border-[#E8D5B7] p-8 text-center">
              <p className="text-4xl mb-3">❤️</p>
              <p className="text-[#8B6F4E] text-sm">Nothing saved yet.</p>
              <p className="text-[#8B6F4E] text-xs mt-1">
                Tap the ❤️ on any itinerary to save it.
              </p>
            </div>
          ) : (
            <HorizontalScrollFeed>
              {bucketItems.map((item) => (
                <ItineraryCard
                  key={item.id}
                  id={item.itinerary.id}
                  title={item.itinerary.title}
                  startDate={item.itinerary.startDate}
                  endDate={item.itinerary.endDate}
                  audience={item.itinerary.audience}
                  budget={item.itinerary.budget}
                  authorName={item.itinerary.user.name}
                  destinations={item.itinerary.destinations}
                  coverPhoto={item.itinerary.photos[0]?.url ?? null}
                  currentUserId={viewerId}
                  isOwn={item.itinerary.user.id === viewerId}
                  isBucketed={ownBucketSet.has(item.itinerary.id)}
                  saveCount={item.itinerary._count.bucketedBy}
                />
              ))}
            </HorizontalScrollFeed>
          )}
        </>
      )}
    </div>
  )
}
