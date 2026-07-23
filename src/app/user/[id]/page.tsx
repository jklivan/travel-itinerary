import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ItineraryCard from '@/components/ItineraryCard'
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
      where: {
        userId: id,
        ...(isOwn ? { visibility: { not: 'draft' } } : { visibility: 'public' }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { take: 1 },
      },
    }),
    isOwn
      ? prisma.itinerary.findMany({
          where: { userId: id, visibility: 'draft' },
          orderBy: { createdAt: 'desc' },
          include: {
            destinations: { orderBy: { order: 'asc' }, include: { items: true } },
            photos: { take: 1 },
          },
        })
      : Promise.resolve([]),
    // Bucket list — only fetch if viewing own profile or if tab=bucket and isOwn
    isOwn
      ? prisma.bucketListItem.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          include: {
            itinerary: {
              include: {
                user: { select: { id: true, name: true } },
                destinations: { orderBy: { order: 'asc' }, include: { items: true } },
                photos: { take: 1 },
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
    // For non-owner viewer, fetch their bucket IDs to show bucket state on cards
    viewerId && !isOwn
      ? prisma.bucketListItem.findMany({ where: { userId: viewerId }, select: { itineraryId: true } })
      : Promise.resolve([]),
  ])

  const followStatus = followRecord?.status ?? 'none'
  const avatarColor = hashPick(user.name, AVATAR_COLORS)
  const initials = getInitials(user.name)

  // Bucket set for showing bucket state on cards
  const viewerBucketSet = new Set(viewerBucketIds.map((b) => b.itineraryId))
  // For own profile, the bucket list items themselves are bucketed
  const ownBucketSet = new Set(bucketItems.map((b) => b.itineraryId))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/friends" className="text-sm text-blue-600 hover:underline mb-5 inline-block">
        ← Friends
      </Link>

      {/* Profile header */}
      <div className="bg-white rounded-xl shadow-md p-5 mb-5 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
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
                  ? 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500'
                  : followStatus === 'pending'
                  ? 'border-amber-300 text-amber-700 hover:border-red-300 hover:text-red-500'
                  : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
              }`}>
              {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : '+ Follow'}
            </button>
          </form>
        )}
      </div>

      {/* Tabs — only show on own profile */}
      {isOwn && (
        <div className="flex gap-1 bg-white rounded-xl p-1 text-sm font-medium shadow-sm border border-gray-100 mb-5 w-fit">
          <Link
            href={`/user/${id}`}
            className={`px-4 py-1.5 rounded-lg transition-colors ${
              !showBucket ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Posts
          </Link>
          <Link
            href={`/user/${id}?tab=bucket`}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              showBucket ? 'bg-red-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>❤️</span> Saved
            {bucketItems.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                showBucket ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {bucketItems.length}
              </span>
            )}
          </Link>
          <Link
            href={`/user/${id}?tab=drafts`}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              showDrafts ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Drafts
            {drafts.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                showDrafts ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {drafts.length}
              </span>
            )}
          </Link>
        </div>
      )}

      {/* Content */}
      {showDrafts ? (
        <>
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Drafts</h2>
          {drafts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500 italic text-sm">No drafts yet.</p>
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
              {drafts.map((it) => (
                <ItineraryCard
                  key={it.id}
                  id={it.id}
                  postType={it.postType}
                  title={it.title}
                  startDate={it.startDate}
                  endDate={it.endDate}
                  audience={it.audience}
                  authorName={user.name}
                  destinations={it.destinations}
                  coverPhoto={it.photos[0]?.url ?? null}
                  currentUserId={viewerId}
                  isOwn={true}
                />
              ))}
            </div>
          )}
        </>
      ) : !showBucket ? (
        <>
          <h2 className="font-semibold text-gray-900 text-sm mb-3">
            {isOwn ? 'Your itineraries' : 'Itineraries'}
          </h2>
          {itineraries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500 italic text-sm">No public itineraries yet.</p>
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
              {itineraries.map((it) => (
                <ItineraryCard
                  key={it.id}
                  id={it.id}
                  title={it.title}
                  startDate={it.startDate}
                  endDate={it.endDate}
                  audience={it.audience}
                  authorName={user.name}
                  destinations={it.destinations}
                  coverPhoto={it.photos[0]?.url ?? null}
                  currentUserId={viewerId}
                  isOwn={isOwn}
                  isBucketed={viewerBucketSet.has(it.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <span>❤️</span> Saved
          </h2>
          {bucketItems.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-4xl mb-3">❤️</p>
              <p className="text-gray-500 text-sm">Nothing saved yet.</p>
              <p className="text-gray-400 text-xs mt-1">
                Tap the ❤️ on any itinerary to save it.
              </p>
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
              {bucketItems.map((item) => (
                <ItineraryCard
                  key={item.id}
                  id={item.itinerary.id}
                  title={item.itinerary.title}
                  startDate={item.itinerary.startDate}
                  endDate={item.itinerary.endDate}
                  audience={item.itinerary.audience}
                  authorName={item.itinerary.user.name}
                  destinations={item.itinerary.destinations}
                  coverPhoto={item.itinerary.photos[0]?.url ?? null}
                  currentUserId={viewerId}
                  isOwn={item.itinerary.user.id === viewerId}
                  isBucketed={ownBucketSet.has(item.itinerary.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
