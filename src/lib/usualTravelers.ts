import { prisma } from '@/lib/prisma'

// Who someone usually travels with, from the last time they answered the planner's "who's going" question
// ("2 adults and 3 children (ages 5, 8 and 10)"), with the children's ages moved on by the years since. The planner
// starts its picker there and checks it's the same group, instead of asking from scratch.
export type UsualTravelers = { adults: number; childAges: number[] }

const ANSWER = /(\d{1,2}) adults?(?: and (\d) (?:child|children) \((?:age|ages) ([\d, and]+)\))?/

export function readTravelers(text: string): UsualTravelers | null {
  const match = ANSWER.exec(text)
  if (!match) return null
  const adults = Number(match[1])
  const childAges = match[3] ? match[3].split(/,\s*|\s+and\s+/).map(Number).filter(age => Number.isInteger(age) && age >= 0 && age < 18) : []
  return adults >= 1 && adults <= 12 && childAges.length === Number(match[2] ?? 0) ? { adults, childAges } : null
}

export async function usualTravelers(userId: string): Promise<UsualTravelers | null> {
  const chats = await prisma.planChat.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 40, select: { updatedAt: true, turns: true } }).catch(() => [])
  for (const chat of chats) {
    const turns = Array.isArray(chat.turns) ? chat.turns as { role?: unknown; text?: unknown }[] : []
    for (const turn of [...turns].reverse()) {
      if (turn?.role !== 'user' || typeof turn.text !== 'string') continue
      const found = readTravelers(turn.text)
      if (!found) continue
      const years = Math.floor((Date.now() - chat.updatedAt.getTime()) / (365.25 * 864e5))
      return { adults: found.adults, childAges: found.childAges.map(age => Math.min(17, age + years)).filter(age => age < 18) }
    }
  }
  return null
}

export const describeTravelers = (usual: UsualTravelers) => `${usual.adults} ${usual.adults === 1 ? 'adult' : 'adults'}${usual.childAges.length ? ` and ${usual.childAges.length} ${usual.childAges.length === 1 ? 'child' : 'children'} (${usual.childAges.length === 1 ? 'age' : 'ages'} ${usual.childAges.join(', ')})` : ''}`
