import { prisma } from '@/lib/prisma'
import { hiddenAccountsFor } from '@/lib/hiddenAccounts'

// Everyone hidden from this person: people they blocked, people who blocked them (it works both ways), and test accounts.
export async function hiddenUserIds(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return hiddenAccountsFor(null)
  const rows = await prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } })
  return [...new Set([...rows.map(row => row.blockerId === userId ? row.blockedId : row.blockerId), ...hiddenAccountsFor(userId)])]
}

// Whether either of two people has blocked the other.
export async function isBlockedBetween(a: string, b: string) {
  return !!await prisma.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { id: true } })
}

export { notBlocked } from './blockFilter'
