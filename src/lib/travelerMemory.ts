import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

// What the AI planner has learned about someone in its chats and keeps for every later chat: lasting things they
// said about themselves ("Vegetarian", "Kids don't enjoy museums", "Prefer small boutique hotels"), not one trip's
// plans (those are each chat's notes). Kept on the account in User.bestVacation.learned (next to the sign-up
// "How you like to travel" answers), listed in Settings → What Postcard knows about you, where they can remove any.
const MAX_ITEMS = 30, MAX_LENGTH = 120

type Stored = Record<string, unknown> & { learned?: unknown }

export function learnedFrom(bestVacation: unknown): string[] {
  const learned = bestVacation && typeof bestVacation === 'object' ? (bestVacation as Stored).learned : null
  return Array.isArray(learned) ? learned.filter((item): item is string => typeof item === 'string' && !!item.trim()) : []
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Adds what the planner just learned and drops what the traveler took back. The newest are kept when there are too many.
export async function updateLearned(userId: string, remember: string[], forget: string[]) {
  const add = remember.map(item => item.trim().slice(0, MAX_LENGTH)).filter(Boolean)
  if (!add.length && !forget.length) return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { bestVacation: true } })
  const stored = (user?.bestVacation && typeof user.bestVacation === 'object' ? user.bestVacation : {}) as Stored
  const kept = learnedFrom(stored).filter(item => !forget.some(gone => same(gone, item)) && !add.some(fresh => same(fresh, item)))
  const learned = [...kept, ...add].slice(-MAX_ITEMS)
  await prisma.user.update({ where: { id: userId }, data: { bestVacation: { ...stored, learned } as Prisma.InputJsonValue } })
}
