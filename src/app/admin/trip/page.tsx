import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import SearchField from '@/components/ui/SearchField'

// Admin only: look up trips by title to see what's stored (dates, length, each place's day and date), for bug reports
// like "photos don't open on the trip's dates".
export default async function AdminTripPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth()
  if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) redirect('/')
  const q = ((await searchParams).q ?? '').trim().slice(0, 100)
  const day = (date: Date | null) => date ? date.toISOString().slice(0, 10) : '—'
  const trips = q ? await prisma.itinerary.findMany({ where: { title: { contains: q, mode: 'insensitive' } }, orderBy: { createdAt: 'desc' }, take: 10,
    select: { id: true, title: true, visibility: true, createdAt: true, startDate: true, endDate: true, datesFlexible: true, durationDays: true, user: { select: { name: true } },
      destinations: { orderBy: { order: 'asc' }, select: { name: true, items: { orderBy: { order: 'asc' }, select: { name: true, type: true, dayIndex: true, date: true, endDate: true } } } } } }) : []
  return <div className="page-wrap">
    <header className="page-header"><h1 className="page-title">Trip lookup</h1><p className="page-subtitle">What a trip has stored. <Link href="/admin" className="text-link underline">Admin</Link></p></header>
    <form><SearchField name="q" defaultValue={q} placeholder="Trip title, e.g. Blackberry" buttonLabel="Look up" /></form>
    <div className="mt-6 space-y-4">{trips.map(trip => <article key={trip.id} className="panel space-y-2 p-4 text-sm">
      <p><Link href={`/plan/${trip.id}`} className="font-semibold text-link underline">{trip.title}</Link> <span className="text-muted">by {trip.user.name} · {trip.visibility} · made {day(trip.createdAt)}</span></p>
      <p><strong>Dates:</strong> {trip.datesFlexible ? 'none (flexible)' : `${day(trip.startDate)} to ${day(trip.endDate)}`} · <strong>Days:</strong> {trip.durationDays ?? '—'}</p>
      <ul className="space-y-0.5 text-xs text-ink-soft">{trip.destinations.flatMap(d => d.items.map((item, index) => <li key={`${d.name}-${index}`}>{d.name} · [{item.type}] {item.name} · day {item.dayIndex ?? '—'} · {day(item.date)}{item.endDate ? ` → ${day(item.endDate)}` : ''}</li>))}</ul>
    </article>)}{q && !trips.length && <p className="text-sm text-muted">No trips found.</p>}</div>
  </div>
}
