import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ItineraryCard from '@/components/ItineraryCard'
import { sendFollowRequest, cancelFollowRequest, unfollowUser } from '@/actions/friends'

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

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, createdAt: true },
  })
  if (!user) notFound()

  const isOwn = session?.user?.id === user.id

  const [itineraries, followRecord, followerCount, followingCount] = await Promise.all([
    prisma.itinerary.findMany({
      where: {
        userId: id,
        // Only show public itineraries unless it's your own profile
        ...(isOwn ? {} : { visibility: 'public' }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        destinations: { orderBy: { order: 'asc' }, include: { items: true } },
        photos: { take: 1 },
      },
    }),
    // Current user's follow relationship to this profile
    session?.user?.id && !isOwn
      ? prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: session.user.id, followingId: id } },
        })
      : Promise.resolve(null),
    prisma.follow.count({ where: { followingId: id, status: 'accepted' } }),
    prisma.follow.count({ where: { followerId: id, status: 'accepted' } }),
  ])

  const followStatus = followRecord?.status ?? 'none'
  const avatarColor = hashPick(user.name, AVATAR_COLORS)
  const initials = getInitials(user.name)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/friends" className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
        ← Friends
      </Link>

      {/* Profile header */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-8 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
          style={{ backgroundColor: avatarColor }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            {followerCount} follower{followerCount !== 1 ? 's' : ''} · {followingCount} following · {itineraries.length} itinerar{itineraries.length !== 1 ? 'ies' : 'y'}
          </p>
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
                  : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
              }`}>
              {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : '+ Follow'}
            </button>
          </form>
        )}
      </div>

      {/* Itineraries */}
      <h2 className="font-semibold text-gray-900 text-lg mb-4">
        {isOwn ? 'Your itineraries' : 'Itineraries'}
      </h2>
      {itineraries.length === 0 ? (
        <p className="text-gray-600 italic">No public itineraries yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
