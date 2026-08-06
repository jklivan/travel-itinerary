'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function sendFollowRequest(userId: string) {
  const session = await auth()
  if (!session?.user?.id) return
  if (userId === session.user.id) return
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
    update: { status: 'accepted' },
    create: { followerId: session.user.id, followingId: userId, status: 'accepted' },
  })
  revalidatePath('/friends')
  revalidatePath('/')
  revalidatePath(`/user/${userId}`)
}

export async function updateAccountPrivacy() {
  const session = await auth()
  if (!session?.user?.id) return
  // Profiles are public for now. Keep this action safe for an older open client.
  await prisma.user.update({ where: { id: session.user.id }, data: { isPrivate: false } })
  await prisma.follow.updateMany({
    where: { followingId: session.user.id, status: 'pending' },
    data: { status: 'accepted' },
  })
  revalidatePath(`/user/${session.user.id}`)
  revalidatePath('/settings')
  revalidatePath('/')
}

export async function cancelFollowRequest(userId: string) {
  const session = await auth()
  if (!session?.user?.id) return
  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, followingId: userId, status: 'pending' },
  })
  revalidatePath('/friends')
}

export async function acceptFollowRequest(followerId: string) {
  const session = await auth()
  if (!session?.user?.id) return
  await prisma.follow.updateMany({
    where: { followerId, followingId: session.user.id, status: 'pending' },
    data: { status: 'accepted' },
  })
  revalidatePath('/friends')
  revalidatePath('/')
}

export async function rejectFollowRequest(followerId: string) {
  const session = await auth()
  if (!session?.user?.id) return
  await prisma.follow.deleteMany({
    where: { followerId, followingId: session.user.id, status: 'pending' },
  })
  revalidatePath('/friends')
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
