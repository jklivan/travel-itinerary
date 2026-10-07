import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function PlanningShortcut({ userId }: { userId: string }) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const current = await prisma.itinerary.findFirst({ where: { userId, datesFlexible: false, startDate: { lte: today }, endDate: { gte: today } }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } })
  const trip = current ?? await prisma.itinerary.findFirst({ where: { userId, visibility: 'draft' }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } })
  return <section className="panel-hint mb-6 p-4">
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-link">{current ? 'Your current trip' : trip ? 'Continue planning' : 'Where next?'}</p><Link href="/plan" className="min-h-11 content-center text-xs text-link underline">Your trips</Link></div>
    <Link href={trip ? `/plan/${trip.id}` : '/plan'} className="block"><h2 className={trip ? 'trip-title break-words font-[family-name:var(--font-playfair)] text-title text-ink' : 'break-words font-[family-name:var(--font-playfair)] text-title text-ink'}>{trip?.title ?? 'Start planning your next trip'}</h2><p className="mt-2 text-sm text-link">{current ? 'Add a place, a note, or a photo →' : trip ? 'Add places & pick up where you left off →' : 'Save ideas now. Decide the days later →'}</p></Link>
  </section>
}
