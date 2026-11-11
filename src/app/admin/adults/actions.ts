'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Admin only: sort old "Adults" trips into Couples or Friends (the /admin/adults page).
export async function setTripGroup(changes: { id: string; audience: string }[]) {
  const email = (await auth())?.user?.email
  if (!process.env.ADMIN_EMAIL || email !== process.env.ADMIN_EMAIL) return { error: 'Not allowed.' }
  if (!Array.isArray(changes) || changes.length > 500 || changes.some(change => typeof change?.id !== 'string' || !['romantic', 'friends'].includes(change.audience))) return { error: 'Invalid.' }
  for (const change of changes) await prisma.itinerary.updateMany({ where: { id: change.id, audience: 'adult' }, data: { audience: change.audience } })
  revalidatePath('/admin/adults')
  return { success: true }
}
