import { prisma } from '@/lib/prisma'

// Everyone hidden from this person: people they blocked, and people who blocked them (it works both ways).
export async function hiddenUserIds(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return []
  const rows = await prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } })
  return [...new Set(rows.map(row => row.blockerId === userId ? row.blockedId : row.blockerId))]
}

// Whether either of two people has blocked the other.
export async function isBlockedBetween(a: string, b: string) {
  return !!await prisma.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { id: true } })
}

export { notBlocked } from './blockFilter'
