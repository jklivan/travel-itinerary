import { prisma } from '@/lib/prisma'
import { readTravelers, type UsualTravelers } from '@/lib/travelers'
export { describeTravelers, readTravelers, type UsualTravelers } from '@/lib/travelers'

// Who someone usually travels with, from the last time they answered the planner's "who's going" question
// ("2 adults and 3 children (ages 5, 8 and 10)"), with the children's ages moved on by the years since. The planner
// starts its picker there and checks it's the same group, instead of asking from scratch.
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

