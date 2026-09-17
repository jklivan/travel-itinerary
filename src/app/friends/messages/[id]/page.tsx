import { redirect } from 'next/navigation'

export default async function LegacyConversationPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ place?: string; trip?: string; before?: string }>
}) {
  const { id } = await params
  const { place, trip, before } = await searchParams
  const query = new URLSearchParams()
  if (place) query.set('place', place)
  if (trip) query.set('trip', trip)
  if (before) query.set('before', before)
  redirect(`/messages/${encodeURIComponent(id)}${query.size ? `?${query}` : ''}`)
}
