import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Mail } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { emailOf, tokenFrom } from '@/lib/inbox'
import { receivedEmail } from '@/lib/inboxImport'
import { allowEmailedSender } from '@/actions/inbox'

export const metadata = { title: 'Add an address' }
// Adding the sender reads their email straight after, which can take a while.
export const maxDuration = 300

// From the "Add … to your Postcard address?" email: someone they hadn't added sent a trip to their Postcard address.
// One button adds them and reads that email.
export default async function AllowSenderPage({ params, searchParams }: { params: Promise<{ emailId: string }>; searchParams: Promise<{ added?: string; failed?: string }> }) {
  const { emailId } = await params
  const { added, failed } = await searchParams
  const userId = (await auth())?.user?.id
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/inbox/allow/${emailId}`)}`)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { inboxToken: true } })
  const email = /^[\w-]{8,100}$/.test(emailId) && !added ? await receivedEmail(emailId).catch(() => null) : null
  const ours = !!email && !!user?.inboxToken && tokenFrom(email.to ?? []) === user.inboxToken
  const sender = email ? emailOf(email.from ?? '') : ''
  return <div className="page-wrap">
    <header className="page-header"><h1 className="page-title">Add an address</h1></header>
    {added ? <div className="panel space-y-3 p-5">
      <p className="text-base text-ink">Added. Postcard is reading the email now.</p>
      <p className="text-sm text-muted">You’ll get an email when its places are in your trips, usually within a couple of minutes. What they send from now on goes straight in.</p>
      <Link href="/trips" className="btn btn-primary w-full">Go to My Trips</Link>
    </div> : failed || !ours ? <div className="panel-dashed p-6 text-sm text-muted">
      This email can’t be found anymore, or it was sent to a different Postcard address. You can add addresses yourself in <Link href="/settings/email" className="text-link underline">Send trips to Postcard</Link>.
    </div> : <form action={allowEmailedSender.bind(null, emailId)} className="panel space-y-4 p-5">
      <p className="flex items-center gap-2 text-base font-semibold text-ink"><Mail size={18} className="shrink-0 text-link" /><span className="min-w-0 break-all">{sender}</span></p>
      <p className="text-sm text-muted">sent “{email.subject?.trim() || 'an email'}” to your Postcard address. Add them, and Postcard reads this email now and adds its places to your trips. Anything they send after that goes straight in.</p>
      <button type="submit" className="btn btn-primary w-full">Add and read this email</button>
      <p className="text-xs text-muted">Don’t know them? Just leave this page. You can remove addresses anytime in <Link href="/settings/email" className="text-link underline">Send trips to Postcard</Link>.</p>
    </form>}
  </div>
}
