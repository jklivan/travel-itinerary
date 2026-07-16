'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function followUser(userId: string) {
  const session = await auth()
  if (!session?.user?.id) return
  if (userId === session.user.id) return
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
    update: {},
    create: { followerId: session.user.id, followingId: userId },
  })
  revalidatePath('/friends')
  revalidatePath('/')
}

export async function unfollowUser(userId: string) {
  const session = await auth()
  if (!session?.user?.id) return
  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, followingId: userId },
  })
  revalidatePath('/friends')
  revalidatePath('/')
}

export async function searchUsers(query: string): Promise<{ id: string; name: string }[]> {
  const session = await auth()
  if (!session?.user?.id || !query.trim()) return []
  return prisma.user.findMany({
    where: { name: { contains: query.trim(), mode: 'insensitive' }, NOT: { id: session.user.id } },
    select: { id: true, name: true },
    take: 10,
  })
}
