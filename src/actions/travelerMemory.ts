'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { updateLearned } from '@/lib/travelerMemory'

// Settings → What Postcard knows about you: remove one thing, so the planner stops using it.
export async function forgetLearned(item: string) {
  const userId = (await auth())?.user?.id
  if (!userId || typeof item !== 'string' || !item) return { error: 'Please sign in.' }
  try { await updateLearned(userId, [], [item]) } catch { return { error: 'Could not remove that. Please try again.' } }
  revalidatePath('/settings')
  return { success: true }
}
