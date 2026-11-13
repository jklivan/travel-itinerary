'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { saveHealth, setMemory, updateLearned } from '@/lib/travelerMemory'

// Settings → What Postcard knows about you: remove one thing, so the planner stops using it.
export async function forgetLearned(item: string) {
  const userId = (await auth())?.user?.id
  if (!userId || typeof item !== 'string' || !item) return { error: 'Please sign in.' }
  try { await updateLearned(userId, [], [item]) } catch { return { error: 'Could not remove that. Please try again.' } }
  revalidatePath('/settings')
  return { success: true }
}

// Settings → Let the planner remember things about me.
export async function switchMemory(on: boolean) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  try { await setMemory(userId, on === true) } catch { return { error: 'Could not save. Please try again.' } }
  revalidatePath('/settings')
  return { success: true }
}

// The chat's consent card: they tapped Save to keep a health detail (see /privacy/health-data).
export async function consentToRemember(item: string) {
  const userId = (await auth())?.user?.id
  if (!userId) return { error: 'Please sign in.' }
  if (typeof item !== 'string' || !item.trim()) return { error: 'Nothing to save.' }
  try { await saveHealth(userId, item) } catch { return { error: 'Could not save. Please try again.' } }
  revalidatePath('/settings')
  return { success: true }
}
