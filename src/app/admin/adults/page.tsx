import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { coupleOrFriends } from '@/lib/adultsAudience'
import AdultsList from './AdultsList'

export const maxDuration = 300

// Admin only: every trip still marked "Adults", each with the AI's guess (Couples or Friends) and why, to apply.
export default async function AdultsPage() {
  const session = await auth()
  if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) redirect('/')
  const trips = await prisma.itinerary.findMany({ where: { audience: 'adult' }, orderBy: { createdAt: 'asc' }, take: 300,
    select: { id: true, title: true, notes: true, visibility: true, user: { select: { name: true } }, members: { where: { status: 'joined' }, select: { id: true } },
      destinations: { select: { items: { select: { type: true, name: true, notes: true } } } } } })
  const rows = await Promise.all(trips.map(async trip => {
    const places = trip.destinations.flatMap(d => d.items)
    const guess = await coupleOrFriends({ title: trip.title, notes: trip.notes, joined: trip.members.length, places })
    return { id: trip.id, title: trip.title || 'Untitled trip', author: trip.user.name, posted: trip.visibility !== 'draft', places: places.length, joined: trip.members.length, guess }
  }))
  return <div className="page-wrap">
    <header className="page-header"><h1 className="page-title">Adults trips</h1><p className="page-subtitle">Trips still marked Adults. Check each guess, change any that are wrong, then apply. <Link href="/admin" className="text-link underline">Admin</Link></p></header>
    {rows.length ? <AdultsList rows={rows} /> : <div className="panel-dashed p-6 text-center text-sm text-muted">No trips are marked Adults.</div>}
  </div>
}
