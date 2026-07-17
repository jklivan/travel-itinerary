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
    update: {},
    create: { followerId: session.user.id, followingId: userId, status: 'pending' },
  })
  revalidatePath('/friends')
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

export async function searchUsersByDestination(
  destination: string
): Promise<{ id: string; name: string; matchedDestinations: string[] }[]> {
  const session = await auth()
  if (!session?.user?.id || !destination.trim()) return []

  const q = destination.trim()
  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      itineraries: {
        some: {
          destinations: {
            some: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { country: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      itineraries: {
        select: {
          destinations: {
            where: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { country: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { name: true, country: true },
          },
        },
      },
    },
    take: 10,
  })

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    matchedDestinations: [
      ...new Set(
        u.itineraries
          .flatMap((i) => i.destinations)
          .map((d) => (d.country ? `${d.name}, ${d.country}` : d.name))
      ),
    ],
  }))
}
