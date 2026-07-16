import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import FriendsUI from './FriendsUI'

export default async function FriendsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const follows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    include: { following: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const following = follows.map((f) => f.following)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
        <p className="text-gray-900 text-sm mt-1">
          Follow travellers to see their itineraries in your feed.
        </p>
      </div>
      <FriendsUI following={following} />
    </div>
  )
}
