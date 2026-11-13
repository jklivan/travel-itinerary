'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { TAGS } from '@/lib/tags'
import { learnedFrom } from '@/lib/travelerMemory'
import { BUDGETS, STAYS, TRAVELERS } from '@/lib/travelPreferences'

export type TravelStyle = { travelers: string[]; budget: number | null; stays: string[]; tags: string[] }

// Sign-up's "How you like to travel": who they usually go with, their usual budget, where they like to stay and what
// they like to do. Kept on the account (User.bestVacation, which also holds the older "best vacation" answers; not
// shown anywhere): the trip planner leans on it until they've added trips of their own.
export async function saveTravelStyle(input: TravelStyle): Promise<{ ok?: boolean; error?: string }> {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  const pick = (values: unknown, allowed: readonly string[]) => Array.isArray(values) ? [...new Set(values.filter((value): value is string => typeof value === 'string' && allowed.includes(value)))] : []
  const travelers = pick(input?.travelers, TRAVELERS)
  const stays = pick(input?.stays, STAYS)
  const tags = pick(input?.tags, TAGS.filter(tag => tag.id !== 'day-trip').map(tag => tag.id))
  const budget = BUDGETS.some(option => option.value === input?.budget) ? input.budget : null
  if (!travelers.length && !stays.length && !tags.length && !budget) return { ok: true }
  try {
    // What the planner has learned in chats (lib/travelerMemory) stays.
    const learned = learnedFrom((await prisma.user.findUnique({ where: { id: userId }, select: { bestVacation: true } }))?.bestVacation)
    await prisma.user.update({ where: { id: userId }, data: { bestVacation: { style: true, travelers, budget, stays, tags, savedAt: new Date().toISOString(), ...(learned.length ? { learned } : {}) } } })
    return { ok: true }
  } catch { return { error: 'Could not save. Please try again.' } }
}
