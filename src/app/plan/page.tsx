import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteButton from '@/components/DeleteButton'
import NewPlanForm from './NewPlanForm'

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ savePlace?: string; saveStory?: string }> }) {
  const { savePlace, saveStory } = await searchParams
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fplan')
  const now = new Date()
  const recentCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const trips = await prisma.itinerary.findMany({ where: { userId, OR: [
    { visibility: 'draft' },
    { isPlan: true, datesFlexible: false, endDate: { gte: today } },
    { createdAt: { gte: recentCutoff } },
  ] }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, visibility: true, isPlan: true, destinations: { select: { name: true, _count: { select: { items: true } } } } } })
  return <div className="mx-auto max-w-2xl px-4 py-7 text-[#2e4147]">
    <section aria-labelledby="start-planning-heading" className="rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4 sm:p-5">
      <header className="mb-4">
        <h1 id="start-planning-heading" className="font-[family-name:var(--font-playfair)] text-2xl tracking-wide text-[#242e25]">Start planning</h1>
        <p className="mt-1 text-sm text-[#73786d]">Collect places now. Work out the days later.</p>
      </header>
      <NewPlanForm saveStory={typeof saveStory === 'string' && saveStory.length <= 200 ? saveStory : undefined} savePlace={typeof savePlace === 'string' && savePlace.length <= 200 ? savePlace : undefined} />
    </section>
    <section className="mt-8" aria-labelledby="your-trips-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="your-trips-heading" className="font-[family-name:var(--font-playfair)] text-2xl tracking-wide text-[#242e25]">Your trips</h2>
        <Link href={`/user/${userId}`} className="inline-flex min-h-10 items-center text-sm font-medium text-[#59694f] hover:underline">All trips →</Link>
      </div>
      {[
        { title: 'Private Plans', description: 'Only you can see these. Keep planning or publish whenever you’re ready.', private: true, empty: 'No private plans yet.' },
        { title: 'Shared Trips', description: 'Already published. You can still add places and update your trip.', private: false, empty: 'No current or recently added shared trips.' },
      ].map(group => {
        const items = trips.filter(trip => (trip.visibility === 'draft') === group.private)
        return <section key={group.title} aria-label={group.title} className="mt-6">
          <div className="mb-3 border-b border-[#d7cebc] pb-3">
            <h3 className="font-[family-name:var(--font-playfair)] text-xl text-[#59694f]">{group.title} <span className="ml-1 font-sans text-sm text-[#73786d]">{items.length}</span></h3>
            <p className="mt-1 text-sm text-[#73786d]">{group.description}</p>
          </div>
          {items.length ? <div className="space-y-3">{items.map(trip => <article key={trip.id} aria-label={trip.title} className="rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4">
            <Link href={`/plan/${trip.id}`} className="block">
              <h4 className="trip-title text-lg font-semibold">{trip.title}</h4>
              <p className="mt-1 text-sm text-[#73786d]">{trip.destinations.reduce((sum, d) => sum + d._count.items, 0)} places · {group.private ? 'Keep planning' : 'Open trip'} →</p>
            </Link>
            <div className="mt-3"><DeleteButton id={trip.id} visibility={trip.visibility} returnTo="/plan" label="Delete trip" /></div>
          </article>)}</div> : <p className="py-3 text-sm text-[#73786d]">{group.empty}</p>}
        </section>
      })}
    </section>
  </div>
}
