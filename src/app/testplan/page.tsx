import { findPlannerTrip, plannerTripProps } from './plannerTrip'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import TestPlanner, { type Turn } from './TestPlanner'
import type { Landing } from './PlanLanding'
import { SETUP_MESSAGE } from '@/lib/travelPreferences'
import { nameChat } from '@/lib/chatTitle'

export const metadata: Metadata = { title: 'Plan with Postcard', robots: { index: false, follow: false } }
export const maxDuration = 300

// Unlinked test page: chat with Claude over your and your friends' trips, add picks to a new plan.
// A past chat's topic for the sidebar: the trip it built, else the first question asked (or, for the
// setup questions, the kinds of places picked).
function chatTopic(turns: Turn[], tripTitle: string | null | undefined) {
  if (tripTitle) return tripTitle
  const question = turns.find(turn => turn.role === 'user' && turn.text !== SETUP_MESSAGE)
  if (question && question.role === 'user') return question.text.length > 60 ? `${question.text.slice(0, 57)}…` : question.text
  const preferences = turns.find(turn => turn.role === 'preferences')
  const kinds = preferences && preferences.role === 'preferences' ? [...preferences.preferences.destinationTypes, ...(preferences.preferences.vibes ?? [])] : []
  return kinds.length ? `${kinds.slice(0, 3).join(' · ')} ideas` : 'Trip ideas'
}

export default async function TestPlanPage({ searchParams }: { searchParams: Promise<{ trip?: string; new?: string; chat?: string; ask?: string; from?: string }> }) {
  const { trip: tripParam, new: fresh, chat: chatParam, ask, from } = await searchParams
  const userId = (await auth())?.user?.id
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(tripParam ? `/testplan?trip=${tripParam}` : '/testplan')}`)
  // Plan with AI always opens a blank chat (on the trip, with ?trip=); ?chat= reopens a past conversation.
  const chat = fresh || !chatParam ? null : await prisma.planChat.findFirst({ where: { userId, id: chatParam }, select: { id: true, tripId: true, turns: true } })
  const tripId = chatParam ? chat?.tripId ?? undefined : tripParam
  // From a trip's planner, past chats are that trip's only.
  const pastChats = await prisma.planChat.findMany({ where: { userId, ...(from === 'planner' && tripId ? { tripId } : {}) }, orderBy: { updatedAt: 'desc' }, take: 30, select: { id: true, updatedAt: true, turns: true, trip: { select: { title: true } } } })
  const history = await Promise.all(pastChats.filter(past => (past.turns as unknown as Turn[]).some(turn => turn.role === 'user'))
    .map(async past => {
      // The AI's latest title and summary for the conversation. Chats from before the planner named
      // itself are named now (once, saved); if that fails they fall back to their topic.
      const turns = past.turns as unknown as Turn[]
      const latest = turns.findLast(turn => turn.role === 'assistant' && !!turn.title)
      const named = latest && latest.role === 'assistant' ? { title: latest.title!, summary: latest.summary ?? '' }
        : turns.some(turn => turn.role === 'assistant') ? await nameChat(past.id, turns, past.updatedAt) : null
      return { id: past.id, topic: named?.title || chatTopic(turns, past.trip?.title), summary: named?.summary || undefined, updatedAt: past.updatedAt.toISOString() }
    }))
  const trip = tripId ? await findPlannerTrip(userId, tripId) : null
  // ?ask= (from "Ask AI about this place" in the planner): start a question about that place.
  const askPlace = ask ? trip?.destinations.flatMap(d => d.items.map(item => ({ item, d }))).find(({ item }) => item.id === ask) : undefined
  const initialDraft = askPlace ? `Tell me more about ${askPlace.item.name} (${[askPlace.d.name, askPlace.d.country].filter(Boolean).join(', ')}): ` : ''
  // A new chat that isn't about a trip opens on the Plan with Postcard start page.
  // The start page also lists the private plans you're working on, so Plan leads back to them.
  const landing: Landing | null = !chat && !trip ? await Promise.all([
    prisma.bucketListItem.count({ where: { userId, itinerary: { visibility: { not: 'draft' } } } }),
    prisma.itinerary.findMany({ where: { userId, isPlan: true, visibility: 'draft' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20,
      select: { id: true, title: true, destinations: { select: { _count: { select: { items: true } } } } } }),
  ]).then(([savedCount, plans]) => ({ savedCount, plans: plans.map(plan => ({ id: plan.id, title: plan.title || 'Untitled trip', places: plan.destinations.reduce((sum, d) => sum + d._count.items, 0) })) })) : null
  return <TestPlanner key={`${chat?.id ?? `new:${tripId ?? ''}`}:${ask ?? ''}`} landing={landing} initialDraft={initialDraft} fromPlanner={from === 'planner'} history={history} chat={chat && { id: chat.id, turns: chat.turns as unknown as Turn[] }} trip={trip && plannerTripProps(trip)} />
}

