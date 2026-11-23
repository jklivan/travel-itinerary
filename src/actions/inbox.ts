'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { cleanInboxName, emailOf, inboxAddress, suggestedInboxName, tokenFrom, validEmail } from '@/lib/inbox'
import { readHeldEmails, receivedEmail } from '@/lib/inboxImport'

// Settings → Send trips to Postcard: turn on or change your address, and choose who besides your account email may
// send to it.
type Result = { address?: string; senders?: string[]; error?: string; reading?: number }

async function signedIn() { return (await auth())?.user?.id ?? null }
async function requestOrigin() { const head = await headers(); return `${head.get('x-forwarded-proto') ?? 'https'}://${head.get('host')}` }

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
  // Anything they sent before being added is read now.
  return { senders, reading: allowed && senders.includes(email) ? await readHeldEmails(userId, email, await requestOrigin()) : 0 }
}

// From the "Add … to your Postcard address?" email (inbox/allow): an email from an address they hadn't added. Adds the
// sender and reads that email now (and any others they sent meanwhile), as if it had just arrived (its reply says what
// was added).
export async function allowEmailedSender(emailId: string) {
  const userId = await signedIn()
  if (!userId) redirect('/login')
  if (typeof emailId !== 'string' || !/^[\w-]{8,100}$/.test(emailId)) redirect('/settings/email')
  const [user, email] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, inboxToken: true, inboxSenders: true } }),
    receivedEmail(emailId).catch(() => null),
  ])
  // Only an email sent to their own address.
  if (!user?.inboxToken || !email || tokenFrom(email.to ?? []) !== user.inboxToken) redirect(`/inbox/allow/${emailId}?failed=1`)
  const sender = emailOf(email.from ?? '')
  if (validEmail(sender) && sender !== user.email.toLowerCase() && !user.inboxSenders.includes(sender)) {
    await prisma.user.update({ where: { id: userId }, data: { inboxSenders: [...user.inboxSenders, sender].slice(-10) } })
    revalidatePath('/settings')
  }
  // This email, and anything else they sent before being added.
  await readHeldEmails(userId, sender, await requestOrigin(), emailId)
  redirect(`/inbox/allow/${emailId}?added=1`)
}
