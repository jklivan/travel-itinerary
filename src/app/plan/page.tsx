import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewPlanForm from './NewPlanForm'

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ savePlace?: string }> }) {
  const { savePlace } = await searchParams
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fplan')
  const trips = await prisma.itinerary.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, visibility: true, isPlan: true, destinations: { select: { name: true, _count: { select: { items: true } } } } } })
  return <div className="mx-auto max-w-2xl px-4 py-7 text-[#2e4147]">
    <h1 className="font-[family-name:var(--font-playfair)] text-3xl">Your next trip starts here</h1>
    <p className="mb-6 mt-2 text-[#73786d]">Collect places now. Work out the days later.</p>
    <NewPlanForm savePlace={typeof savePlace === 'string' && savePlace.length <= 200 ? savePlace : undefined} />
    <div className="my-5 flex flex-wrap gap-4 text-sm text-[#507c76]"><Link href="/create" className="underline">Import notes or a file</Link><Link href="/create/guided" className="underline">Build a full itinerary</Link></div>
    {trips.length > 0 && <section className="mt-8"><h2 className="mb-3 text-xl font-semibold">Your trips</h2><div className="space-y-3">{trips.map(trip => <Link key={trip.id} href={`/plan/${trip.id}`} className="block rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#507c76]">{trip.visibility === 'draft' ? 'Private plan' : 'Shared trip'}</p>
      <h3 className="mt-1 text-lg font-semibold">{trip.title}</h3><p className="mt-1 text-sm text-[#73786d]">{trip.destinations.reduce((sum, d) => sum + d._count.items, 0)} places · Open trip →</p>
    </Link>)}</div></section>}
  </div>
}
