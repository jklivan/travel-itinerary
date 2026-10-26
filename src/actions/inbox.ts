'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { cleanInboxName, emailOf, inboxAddress, suggestedInboxName, validEmail } from '@/lib/inbox'

// Settings → Send trips to Postcard: turn on or change your address, and choose who besides your account email may
// send to it.
type Result = { address?: string; senders?: string[]; error?: string }

async function signedIn() { return (await auth())?.user?.id ?? null }

// Turn the address on: a name from the person's own (jen.rosenthal), with a number added if it's taken.
export async function createInbox(): Promise<Result> {
  const userId = await signedIn()
  if (!userId) return { error: 'Please sign in.' }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, inboxToken: true, inboxSenders: true } })
  if (!user) return { error: 'Please sign in.' }
  if (user.inboxToken) return { address: inboxAddress(user.inboxToken), senders: user.inboxSenders }
  const base = suggestedInboxName(user.name, user.email)
  for (let attempt = 1; attempt <= 50; attempt++) {
    const name = attempt === 1 ? base : `${base}${attempt}`
    try {
      await prisma.user.update({ where: { id: userId }, data: { inboxToken: name } })
      revalidatePath('/settings')
      return { address: inboxAddress(name), senders: user.inboxSenders }
    } catch { /* taken: try the next number */ }
  }
  return { error: 'Couldn’t make an address. Choose one yourself below.' }
}

// Change it to a name they pick. The old address stops working straight away.
export async function renameInbox(value: string): Promise<Result> {
  const userId = await signedIn()
  if (!userId) return { error: 'Please sign in.' }
  const cleaned = cleanInboxName(typeof value === 'string' ? value : '')
  if ('error' in cleaned) return { error: cleaned.error }
  const taken = await prisma.user.findFirst({ where: { inboxToken: cleaned.name, id: { not: userId } }, select: { id: true } })
  if (taken) return { error: `${inboxAddress(cleaned.name)} is taken. Try another, like adding a number.` }
  try {
    const user = await prisma.user.update({ where: { id: userId }, data: { inboxToken: cleaned.name }, select: { inboxSenders: true } })
    revalidatePath('/settings')
    return { address: inboxAddress(cleaned.name), senders: user.inboxSenders }
  } catch { return { error: `${inboxAddress(cleaned.name)} is taken. Try another.` } }
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
