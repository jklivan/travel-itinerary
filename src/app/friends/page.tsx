import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import FriendsUI from './FriendsUI'

export default async function FriendsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [acceptedFollows, pendingOutgoingFollows, incomingFollowRequests] = await Promise.all([
    // People I follow (accepted)
    prisma.follow.findMany({
      where: { followerId: session.user.id, status: 'accepted' },
      include: { following: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // Requests I've sent that haven't been accepted yet
    prisma.follow.findMany({
      where: { followerId: session.user.id, status: 'pending' },
      include: { following: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // Requests others have sent me
    prisma.follow.findMany({
      where: { followingId: session.user.id, status: 'pending' },
      include: { follower: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
        <p className="text-gray-900 text-sm mt-1">
          Follow travellers to see their itineraries in your feed.
        </p>
      </div>
      <FriendsUI
        following={acceptedFollows.map((f) => f.following)}
        pendingOutgoing={pendingOutgoingFollows.map((f) => f.following)}
        incomingRequests={incomingFollowRequests.map((f) => f.follower)}
      />
    </div>
  )
}
