'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { emailOf, inboxAddress, newInboxToken, validEmail } from '@/lib/inbox'

// Settings → Send trips to Postcard: turn on (or reset) your private address, and choose who besides your account
// email may send to it.
type Result = { address?: string; senders?: string[]; error?: string }

async function signedIn() { return (await auth())?.user?.id ?? null }

export async function createInbox(reset = false): Promise<Result> {
  const userId = await signedIn()
  if (!userId) return { error: 'Please sign in.' }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { inboxToken: true, inboxSenders: true } })
  if (user?.inboxToken && !reset) return { address: inboxAddress(user.inboxToken), senders: user.inboxSenders }
  // A fresh address; the old one stops working straight away.
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = newInboxToken()
    try {
      const saved = await prisma.user.update({ where: { id: userId }, data: { inboxToken: token }, select: { inboxSenders: true } })
      revalidatePath('/settings')
      return { address: inboxAddress(token), senders: saved.inboxSenders }
    } catch { /* taken by someone else: try another */ }
  }
  return { error: 'Couldn’t make an address. Please try again.' }
}

export async function setInboxSender(address: string, allowed: boolean): Promise<Result> {
  const userId = await signedIn()
  if (!userId) return { error: 'Please sign in.' }
  const email = emailOf(typeof address === 'string' ? address : '')
  if (!validEmail(email)) return { error: 'Enter an email address, like name@example.com.' }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, inboxSenders: true } })
  if (!user) return { error: 'Please sign in.' }
  if (allowed && email === user.email.toLowerCase()) return { senders: user.inboxSenders, error: 'Your account email can always send. Add a different address.' }
  const senders = allowed ? [...new Set([...user.inboxSenders, email])].slice(0, 10) : user.inboxSenders.filter(sender => sender !== email)
  await prisma.user.update({ where: { id: userId }, data: { inboxSenders: senders } })
  revalidatePath('/settings')
  return { senders }
}
