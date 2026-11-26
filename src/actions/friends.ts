'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { isBlockedBetween, hiddenUserIds } from '@/lib/blocks'
import { hiddenAccountsFor } from '@/lib/hiddenAccounts'
import { after } from 'next/server'
import { createFollowNotification } from '@/lib/notifications'
import { deliverNotification } from '@/lib/push'

export async function sendFollowRequest(userId: string) {
  const session = await auth()
  if (!session?.user?.id) return
  if (userId === session.user.id) return
  if (await isBlockedBetween(session.user.id, userId)) return
  const followerId = session.user.id
  const notificationId = await prisma.$transaction(async tx => {
    await tx.follow.upsert({
      where: { followerId_followingId: { followerId, followingId: userId } },
      update: { status: 'accepted' },
      create: { followerId, followingId: userId, status: 'accepted' },
    })
    return createFollowNotification(tx, followerId, userId)
  })
  if (notificationId) after(async () => { try { await deliverNotification(notificationId) } catch { console.error('Follow push delivery failed') } })
  revalidatePath('/friends')
  revalidatePath('/notifications')
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

export async function searchUsers(query: string): Promise<{ id: string; name: string; image: string | null }[]> {
  const session = await auth()
  if (!session?.user?.id || !query.trim()) return []
  return prisma.user.findMany({
    where: { name: { contains: query.trim(), mode: 'insensitive' }, id: { notIn: [session.user.id, ...hiddenAccountsFor(session.user.id)] } },
    select: { id: true, name: true, image: true },
    take: 10,
  })
}

// Find friends from your contacts (iPhone app): which of these email addresses belong to Postcard accounts.
// The addresses are only compared, never saved. Blocked people, test accounts and you are left out.
export async function findContactsOnPostcard(emails: string[]): Promise<{ id: string; name: string; image: string | null; email: string; following: boolean }[]> {
  const session = await auth()
  if (!session?.user?.id || !Array.isArray(emails)) return []
  const wanted = [...new Set(emails.filter(e => typeof e === 'string').map(e => e.trim().toLowerCase()).filter(e => e.includes('@') && e.length <= 254))].slice(0, 5000)
  if (!wanted.length) return []
  const hidden = [session.user.id, ...await hiddenUserIds(session.user.id)]
  const users = await prisma.user.findMany({
    where: { email: { in: wanted, mode: 'insensitive' }, id: { notIn: hidden } },
    select: { id: true, name: true, image: true, email: true, followers: { where: { followerId: session.user.id }, select: { status: true } } },
    orderBy: { name: 'asc' },
  })
  return users.map(({ followers, ...u }) => ({ ...u, email: u.email.toLowerCase(), following: followers.length > 0 }))
}
