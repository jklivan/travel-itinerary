'use server'

import { revalidatePath } from 'next/cache'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { unregisterPushDevice } from '@/actions/notifications'

import { REPORT_KINDS as KINDS, REPORT_REASONS, type ReportKind } from '@/lib/reports'

// Whose content it is, and whether the reporter can see it (you can only report what you can see).
async function subjectOf(kind: ReportKind, targetId: string, reporterId: string): Promise<string | null | undefined> {
  if (kind === 'user') return (await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }))?.id
  if (kind === 'trip') return (await prisma.itinerary.findFirst({ where: { id: targetId, OR: [{ visibility: { not: 'draft' } }, { userId: reporterId }] }, select: { userId: true } }))?.userId
  if (kind === 'comment') return (await prisma.comment.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId
  if (kind === 'message') return (await prisma.directMessage.findFirst({ where: { id: targetId, OR: [{ senderId: reporterId }, { recipientId: reporterId }] }, select: { senderId: true } }))?.senderId
  if (kind === 'snapshot') return (await prisma.story.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId
  return (await prisma.friendQuestion.findUnique({ where: { id: targetId }, select: { authorId: true } }))?.authorId
}

// Report a trip, comment, message, snapshot, question or person. Reviewed on the admin page within 24 hours.
export async function reportContent(kind: ReportKind, targetId: string, reason: string, details = '') {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in to report.' }
  if (!KINDS.includes(kind) || typeof targetId !== 'string' || !targetId || targetId.length > 200) return { error: 'This can’t be reported.' }
  if (!REPORT_REASONS.includes(reason as typeof REPORT_REASONS[number])) return { error: 'Choose a reason.' }
  if (typeof details !== 'string' || details.length > 1000) return { error: 'Please shorten your note.' }
  try {
    const subjectId = await subjectOf(kind, targetId, userId)
    if (subjectId === undefined) return { error: 'This is no longer available.' }
    if (subjectId === userId) return { error: 'You can’t report your own posts.' }
    await prisma.report.create({ data: { reporterId: userId, subjectId, kind, targetId, reason, details: details.trim() || null } })
    console.warn('[report]', JSON.stringify({ kind, targetId, reason }))
    return { success: true, subjectId }
  } catch { return { error: 'Could not send your report. Please try again.' } }
}

// Block someone: hides their trips, comments, snapshots and messages from you (and yours from them), removes
// follows between you, and stops messages.
export async function blockUser(blockedId: string) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (typeof blockedId !== 'string' || !blockedId || blockedId === userId) return { error: 'You can’t block this account.' }
  try {
    await prisma.$transaction([
      prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId } }, update: {}, create: { blockerId: userId, blockedId } }),
      prisma.follow.deleteMany({ where: { OR: [{ followerId: userId, followingId: blockedId }, { followerId: blockedId, followingId: userId }] } }),
    ])
    for (const path of ['/', '/explore', '/friends', '/messages', `/user/${blockedId}`]) revalidatePath(path)
    return { success: true }
  } catch { return { error: 'Could not block. Please try again.' } }
}

export async function unblockUser(blockedId: string) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  await prisma.block.deleteMany({ where: { blockerId: userId, blockedId } })
  for (const path of ['/', '/explore', '/settings', `/user/${blockedId}`]) revalidatePath(path)
  return { success: true }
}

// Deletes the account and everything in it: trips (with their places, photos and comments), comments, likes,
// saves, follows, messages, snapshots and questions. Can't be undone. Signs out after.
export async function deleteAccount(confirmation: string) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (confirmation !== 'DELETE') return { error: 'Type DELETE to confirm.' }
  try {
    await unregisterPushDevice().catch(() => {})
    await prisma.$transaction([
      // Trips first (they don't go with the account on their own); everything else is removed with the account.
      prisma.itinerary.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ])
  } catch { return { error: 'Could not delete your account. Please try again.' } }
  await signOut({ redirectTo: '/?accountDeleted=1' })
}

// Admin: mark a report handled.
export async function handleReport(id: string) {
  const session = await auth()
  if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) return { error: 'Not allowed.' }
  await prisma.report.updateMany({ where: { id }, data: { status: 'handled', handledAt: new Date() } })
  revalidatePath('/admin')
  return { success: true }
}
