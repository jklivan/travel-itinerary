import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import NewPlanForm from './NewPlanForm'
import { fetchStockPhoto } from '@/lib/stockPhoto'
import { ChevronRight, Sparkles } from 'lucide-react'

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ savePlace?: string; saveStory?: string; from?: string }> }) {
  const { savePlace, saveStory, from } = await searchParams
  // Post → New trip from scratch lands here too: the same new-trip step and planner, minus Plan with AI.
  const posting = from === 'post'
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fplan')
  const now = new Date()
  const recentCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  // Private plans live on My Trips; this tab only shows current or recently added shared trips.
  const trips = await prisma.itinerary.findMany({ where: { userId, visibility: { not: 'draft' }, OR: [
    { isPlan: true, datesFlexible: false, endDate: { gte: today } },
    { createdAt: { gte: recentCutoff } },
  ] }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, photos: { where: { isStock: false }, select: { url: true } }, destinations: { select: { name: true, country: true, _count: { select: { items: true } }, items: { select: { photoUrls: true, photoUrl: true } } } } } })
  const coverPhotos = new Map<string, string>()
  await Promise.all(trips.map(async trip => {
    const itemPhoto = trip.destinations.flatMap(destination => destination.items).flatMap(item => item.photoUrls ?? (item.photoUrl ? [item.photoUrl] : [])).find(Boolean)
    const photo = trip.photos[0]?.url ?? itemPhoto
    if (photo) { coverPhotos.set(trip.id, photo); return }
    const destination = trip.destinations[0]
    if (destination) {
      const fetched = await fetchStockPhoto(`${trip.title} ${destination.name} ${destination.country ?? ''} travel`).catch(() => null)
      if (fetched) coverPhotos.set(trip.id, fetched)
    }
  }))
  return <div className="mx-auto max-w-2xl px-4 py-7 text-ink">
    <section aria-labelledby="start-planning-heading" className="bg-transparent">
      <header className="relative mb-5 px-1">
        <h1 id="start-planning-heading" className="max-w-sm pr-20 sm:pr-8 font-[family-name:var(--font-playfair)] text-4xl uppercase leading-[0.98] tracking-[0.03em] text-ink">Your next trip starts here</h1>
        <Image src="/brand/postcard-stamp-logo.png" alt="" width={84} height={84} className="absolute -top-1 right-0 rotate-[8deg]" />
        <p className="mt-2 text-sm text-muted">{posting ? 'Add your places, then post it when you’re ready.' : 'Collect places now. Work out the details later.'}</p>
      </header>
      {!posting && <Link href="/testplan" className="group mb-5 flex items-center gap-3 rounded-2xl border border-mist-line bg-mist p-4 text-ink transition-colors hover:bg-mist-strong">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Sparkles size={20} /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">Plan with AI</span><span className="block text-sm text-link">Ask where to go, using what you and your friends loved.</span></span>
        <ChevronRight size={20} className="shrink-0 text-link transition-transform group-hover:translate-x-0.5" />
      </Link>}
      <NewPlanForm saveStory={typeof saveStory === 'string' && saveStory.length <= 200 ? saveStory : undefined} savePlace={typeof savePlace === 'string' && savePlace.length <= 200 ? savePlace : undefined} />
    </section>
    <section className="mt-8" aria-labelledby="your-trips-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="your-trips-heading" className="font-[family-name:var(--font-playfair)] text-2xl tracking-wide text-ink">Your trips</h2>
        <Link href="/trips" className="inline-flex min-h-10 items-center text-sm font-medium text-link hover:underline">All trips →</Link>
      </div>
      <section aria-label="Shared Trips" className="mt-6">
          <div className="mb-3 border-b border-line pb-3">
            <h3 className="font-[family-name:var(--font-playfair)] text-xl text-link">Shared Trips <span className="ml-1 font-sans text-sm text-muted">{trips.length}</span></h3>
            <p className="mt-1 text-sm text-muted">Already published. You can still add places and update your trip.</p>
          </div>
          {trips.length ? <div className="space-y-3">{trips.map(trip => <article key={trip.id} aria-label={trip.title} className="relative min-h-[190px] overflow-hidden rounded-2xl border border-line bg-card p-3">
            <Link href={`/plan/${trip.id}`} className="flex min-h-[164px] items-stretch gap-4 pr-3">
              <span className="relative aspect-[3/4] w-32 shrink-0 rotate-[-3deg] overflow-hidden border-[5px] border-white bg-mist shadow-[0_2px_5px_rgba(45,38,27,0.18)]">{coverPhotos.get(trip.id) ? <Image src={coverPhotos.get(trip.id)!} alt="" fill sizes="128px" className="object-cover" /> : <span className="grid h-full place-items-center text-center text-[9px] uppercase tracking-wider text-link">Postcard</span>}</span>
              <span className="min-w-0 flex-1 pt-2"><h4 className="trip-title break-words text-lg font-semibold">{trip.title}</h4><p className="mt-2 text-sm text-muted">{trip.destinations.reduce((sum, d) => sum + d._count.items, 0)} places · Open trip →</p></span>
            </Link>
          </article>)}</div> : <p className="py-3 text-sm text-muted">No current or recently added shared trips.</p>}
      </section>
    </section>
  </div>
}
