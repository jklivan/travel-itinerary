import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { findFriendsPlanPlaces } from '@/actions/planSuggestions'
import { planSuggestionQuery } from '@/lib/planPlaceIdentity'
import PlanFriendsBrowser from '@/components/PlanFriendsBrowser'

export default async function PlanFriendsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = (await auth())?.user?.id
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/plan/${id}/friends`)}`)
  const plan = await prisma.itinerary.findFirst({ where: { id, userId, isPlan: true }, select: { id: true, title: true, destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true } } } })
  if (!plan) notFound()
  const query = planSuggestionQuery(plan.title, plan.destinations)
  const results = query ? await findFriendsPlanPlaces(id, query) : { trips: [], hasMore: false }
  return <PlanFriendsBrowser key={id} plan={plan} initialQuery={query} initialResults={results} />
}
