import { placeTown } from '@/lib/placeTown'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import TestPlanner, { type Turn } from './TestPlanner'
import { cleanPreferences, SETUP_MESSAGE } from '@/lib/travelPreferences'
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
  const kinds = preferences && preferences.role === 'preferences' ? preferences.preferences.destinationTypes : []
  return kinds.length ? `${kinds.slice(0, 3).join(' · ')} ideas` : 'Trip ideas'
}

export default async function TestPlanPage({ searchParams }: { searchParams: Promise<{ trip?: string; new?: string; chat?: string; ask?: string; from?: string }> }) {
  const { trip: tripParam, new: fresh, chat: chatParam, ask, from } = await searchParams
  const userId = (await auth())?.user?.id
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(tripParam ? `/testplan?trip=${tripParam}` : '/testplan')}`)
  // Plan with AI always opens a blank chat (on the trip, with ?trip=); ?chat= reopens a past conversation.
  const chat = fresh || !chatParam ? null : await prisma.planChat.findFirst({ where: { userId, id: chatParam }, select: { id: true, tripId: true, turns: true } })
  const tripId = chatParam ? chat?.tripId ?? undefined : tripParam
  // Travelers with no trips of their own are asked about budget, destinations and activities first;
  // answers from their last chat pre-fill the next one.
  const [ownTrips, lastSetup, pastChats] = await Promise.all([
    prisma.itinerary.count({ where: { userId, destinations: { some: { items: { some: {} } } } } }),
    prisma.planChat.findFirst({ where: { userId, turns: { array_contains: [{ role: 'preferences' }] } }, orderBy: { updatedAt: 'desc' }, select: { turns: true } }),
    prisma.planChat.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 30, select: { id: true, updatedAt: true, turns: true, trip: { select: { title: true } } } }),
  ])
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
  const lastPreferences = cleanPreferences((lastSetup?.turns as unknown as { role: string; preferences?: unknown }[] | undefined)?.findLast(turn => turn.role === 'preferences')?.preferences)
  const trip = tripId ? await prisma.itinerary.findFirst({ where: { id: tripId, userId }, include: { destinations: { orderBy: { order: 'asc' }, include: { items: { orderBy: { order: 'asc' } } } } } }) : null
  // ?ask= (from "Ask AI about this place" in the planner): start a question about that place.
  const askPlace = ask ? trip?.destinations.flatMap(d => d.items.map(item => ({ item, d }))).find(({ item }) => item.id === ask) : undefined
  const initialDraft = askPlace ? `Tell me more about ${askPlace.item.name} (${[askPlace.d.name, askPlace.d.country].filter(Boolean).join(', ')}): ` : ''
  return <TestPlanner key={`${chat?.id ?? `new:${tripId ?? ''}`}:${ask ?? ''}`} initialDraft={initialDraft} fromPlanner={from === 'planner'} history={history} hasOwnTrips={ownTrips > 0} lastPreferences={lastPreferences} chat={chat && { id: chat.id, turns: chat.turns as unknown as Turn[] }} trip={trip && { id: trip.id, title: trip.title,
    places: trip.destinations.flatMap(d => d.items.map(item => ({ id: item.id, name: item.name, type: item.type, notes: item.notes, placeId: item.placeId, lat: item.lat, lng: item.lng,
      day: item.dayIndex === null ? null : item.dayIndex + (d.items.some(i => i.type !== 'hotel' && i.dayIndex === 0) ? 1 : 0),
      photos: item.photoUrls.length ? item.photoUrls : item.photoUrl ? [item.photoUrl] : [],
      destination: item.address ? placeTown(item.address) : [d.name, d.country].filter(Boolean).join(', ') }))),
  }} />
}
