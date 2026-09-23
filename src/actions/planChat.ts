'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// Attaches a /testplan conversation to the trip it just created, so reopening the trip resumes the chat.
export async function linkPlanChat(chatId: string, tripId: string) {
  const userId = (await auth())?.user?.id
  if (!userId || typeof chatId !== 'string' || typeof tripId !== 'string') return { error: 'Please sign in.' }
  const trip = await prisma.itinerary.findFirst({ where: { id: tripId, userId }, select: { id: true } })
  if (!trip) return { error: 'This trip is unavailable.' }
  await prisma.planChat.updateMany({ where: { id: chatId, userId, tripId: null }, data: { tripId } })
  return { success: true }
}
