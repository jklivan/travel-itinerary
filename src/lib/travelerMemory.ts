import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

// What the AI planner has learned about someone in its chats and keeps for every later chat: lasting things they
// said about themselves ("Vegetarian", "Kids don't enjoy museums", "Prefer small boutique hotels"), not one trip's
// plans (those are each chat's notes). Kept on the account in User.bestVacation.learned (next to the sign-up
// "How you like to travel" answers), listed in Settings → What Postcard knows about you, where they can remove any or
// switch remembering off (bestVacation.memoryOff). Like ChatGPT's memory, sensitive details (health, allergies,
// religion…) are only kept when they ask for them to be remembered: that's the planner's call, in its instructions.
const MAX_ITEMS = 30, MAX_LENGTH = 120

type Stored = Record<string, unknown> & { learned?: unknown }

export function memoryOn(bestVacation: unknown) {
  return !(bestVacation && typeof bestVacation === 'object' && (bestVacation as Stored).memoryOff === true)
}

export function learnedFrom(bestVacation: unknown): string[] {
  if (!memoryOn(bestVacation)) return []
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
  if (!memoryOn(stored)) return
  const kept = learnedFrom(stored).filter(item => !forget.some(gone => same(gone, item)) && !add.some(fresh => same(fresh, item)))
  const learned = [...kept, ...add].slice(-MAX_ITEMS)
  await prisma.user.update({ where: { id: userId }, data: { bestVacation: { ...stored, learned } as Prisma.InputJsonValue } })
}

// Settings switch: off stops the planner remembering and clears what it had; on starts remembering again.
export async function setMemory(userId: string, on: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { bestVacation: true } })
  const stored = (user?.bestVacation && typeof user.bestVacation === 'object' ? user.bestVacation : {}) as Stored
  const rest = Object.fromEntries(Object.entries(stored).filter(([key]) => key !== 'learned' && key !== 'memoryOff'))
  await prisma.user.update({ where: { id: userId }, data: { bestVacation: (on ? rest : { ...rest, memoryOff: true }) as Prisma.InputJsonValue } })
}
