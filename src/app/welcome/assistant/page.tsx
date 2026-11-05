import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { saveTripId } from '@/lib/saveTripReturn'
import { inboxAddress } from '@/lib/inbox'
import TripInbox from '@/components/TripInbox'
import AssistantConnect from '@/components/AssistantConnect'

// Sign-up, after following people: bring trips in with an AI assistant (Instinct, Muse…), by getting a Postcard
// email address to send confirmations and summaries to, or connecting the assistant. Both are also in Settings.
export default async function WelcomeAssistantPage({ searchParams }: { searchParams: Promise<{ saveTrip?: string }> }) {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fwelcome%2Fassistant')
  const tripId = saveTripId((await searchParams).saveTrip ?? null)
  const next = `/welcome/trip${tripId ? `?saveTrip=${encodeURIComponent(tripId)}` : ''}`
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, inboxToken: true, inboxSenders: true } })

  return <div className="page-wrap">
    <header className="page-header">
      <h1 className="page-title">Bring your AI assistant</h1>
      <p className="page-subtitle">Use Instinct, Muse, ChatGPT or Claude? Have it send your trips to Postcard, so you don’t type them in. You can set this up any time in Settings.</p>
    </header>
    {me && <TripInbox initialAddress={me.inboxToken ? inboxAddress(me.inboxToken) : null} initialSenders={me.inboxSenders} accountEmail={me.email} />}
    <AssistantConnect />
    <Link href={next} className="btn btn-primary mt-6 w-full">Continue</Link>
  </div>
}
