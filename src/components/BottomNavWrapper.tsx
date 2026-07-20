import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import BottomNav from './BottomNav'

export default async function BottomNavWrapper() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const pendingCount = userId
    ? await prisma.follow.count({ where: { followingId: userId, status: 'pending' } })
    : 0

  return <BottomNav userId={userId} pendingCount={pendingCount} />
}
