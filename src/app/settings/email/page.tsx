import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { inboxAddress } from '@/lib/inbox'
import TripInbox from '@/components/TripInbox'
import { returnPath } from '@/lib/returnPath'

// Settings → Send trips to Postcard (also the intro's last slide): your own address for confirmations and trip
// summaries. From the intro, Continue goes back to signing up.
export default async function EmailSettingsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fsettings%2Femail')
  const next = returnPath((await searchParams).next)
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, inboxToken: true, inboxSenders: true } })
  return <div className="page-wrap">
    <header className="page-header">
      <h1 className="page-title">Email trips to Postcard</h1>
      <p className="page-subtitle">Forward itineraries, confirmations or notes, and we’ll make a trip for you.</p>
    </header>
    {me && <TripInbox initialAddress={me.inboxToken ? inboxAddress(me.inboxToken) : null} initialSenders={me.inboxSenders} accountEmail={me.email} />}
    {next ? <Link href={next} className="btn btn-primary mt-6 w-full">Continue</Link> : <Link href="/settings" className="mt-6 inline-block text-sm text-link underline">← Settings</Link>}
  </div>
}
