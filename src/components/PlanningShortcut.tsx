import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function PlanningShortcut({ userId }: { userId: string }) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const current = await prisma.itinerary.findFirst({ where: { userId, datesFlexible: false, startDate: { lte: today }, endDate: { gte: today } }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } })
  const trip = current ?? await prisma.itinerary.findFirst({ where: { userId, visibility: 'draft' }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } })
  return <section className="mb-6 rounded-2xl border border-[#c8d2e0] bg-[#eaeff6] p-4">
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#3f5a80]">{current ? 'Your current trip' : trip ? 'Continue planning' : 'Where next?'}</p><Link href="/plan" className="min-h-11 content-center text-xs text-[#3f5a80] underline">Your trips</Link></div>
    <Link href={trip ? `/plan/${trip.id}` : '/plan'} className="block"><h2 className={trip ? 'trip-title break-words font-[family-name:var(--font-playfair)] text-xl text-[#1f3354]' : 'break-words font-[family-name:var(--font-playfair)] text-xl text-[#1f3354]'}>{trip?.title ?? 'Start planning your next trip'}</h2><p className="mt-2 text-sm text-[#3f5a80]">{current ? 'Add a place, a note, or a photo →' : trip ? 'Add places & pick up where you left off →' : 'Save ideas now. Decide the days later →'}</p></Link>
  </section>
}
