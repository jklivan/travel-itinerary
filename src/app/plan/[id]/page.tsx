import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Planner from './Planner'

export const maxDuration = 300

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ import?: string; details?: string }> }) {
  const { id } = await params
  const search = await searchParams
  const importing = search.import === '1'
  const userId = (await auth())?.user?.id
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/plan/${id}`)}`)
  const trip = await prisma.itinerary.findFirst({ where: { id, userId }, include: { destinations: { orderBy: { order: 'asc' }, include: { items: { orderBy: { order: 'asc' } } } } } })
  if (!trip) notFound()
  return <Planner initialImport={importing} initialDetails={search.details === '1'} trip={{ id: trip.id, title: trip.title, isPlan: trip.isPlan, visibility: trip.visibility,
    start: trip.datesFlexible ? '' : trip.startDate.toISOString().slice(0, 10), end: trip.datesFlexible ? '' : trip.endDate.toISOString().slice(0, 10),
    destinations: trip.destinations.map(d => ({ id: d.id, name: d.name, country: d.country, items: d.items.map(item => ({ id: item.id, name: item.name, placeId: item.placeId, lat: item.lat, lng: item.lng, type: item.type, notes: item.notes, status: item.planningStatus,
      day: item.dayIndex === null ? null : item.dayIndex + (d.items.some(i => i.type !== 'hotel' && i.dayIndex === 0) ? 1 : 0),
      photos: item.photoUrls.length ? item.photoUrls : item.photoUrl ? [item.photoUrl] : [], rating: item.rating,
    })) })),
  }} />
}
