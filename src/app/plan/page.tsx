import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import DeleteButton from '@/components/DeleteButton'
import NewPlanForm from './NewPlanForm'
import { fetchStockPhoto } from '@/lib/stockPhoto'

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
  ] }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, visibility: true, isPlan: true, photos: { where: { isStock: false }, select: { url: true } }, destinations: { select: { name: true, country: true, _count: { select: { items: true } }, items: { select: { photoUrls: true, photoUrl: true } } } } } })
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
  return <div className="mx-auto max-w-2xl px-4 py-7 text-[#2e4147]">
    <section aria-labelledby="start-planning-heading" className="bg-transparent">
      <header className="mb-5 px-1">
        <h1 id="start-planning-heading" className="max-w-sm font-[family-name:var(--font-playfair)] text-4xl uppercase leading-[0.98] tracking-[0.03em] text-[#2e4147]">Your next trip starts here</h1>
        <p className="mt-2 text-sm text-[#73786d]">Collect places now. Work out the details later.</p>
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
          {items.length ? <div className="space-y-3">{items.map(trip => <article key={trip.id} aria-label={trip.title} className="relative min-h-[190px] overflow-hidden rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-3">
            <Link href={`/plan/${trip.id}`} className="flex min-h-[164px] items-stretch gap-4 pr-3">
              <span className="relative aspect-[3/4] w-32 shrink-0 rotate-[-3deg] overflow-hidden border-[5px] border-white bg-[#e8eee8] shadow-[0_2px_5px_rgba(45,38,27,0.18)]">{coverPhotos.get(trip.id) ? <Image src={coverPhotos.get(trip.id)!} alt="" fill sizes="128px" className="object-cover" /> : <span className="grid h-full place-items-center text-center text-[9px] uppercase tracking-wider text-[#59694f]">Postcard</span>}</span>
              <span className="min-w-0 flex-1 pt-2"><h4 className="trip-title break-words text-lg font-semibold">{trip.title}</h4><p className="mt-2 text-sm text-[#73786d]">{trip.destinations.reduce((sum, d) => sum + d._count.items, 0)} places · {group.private ? 'Keep planning' : 'Open trip'} →</p></span>
            </Link>
            {group.private && <div className="absolute right-3 top-3"><DeleteButton compact id={trip.id} visibility={trip.visibility} returnTo="/plan" label="Delete trip" /></div>}
            {group.private && <Link href={`/plan/${trip.id}?post=1`} aria-label={`Post ${trip.title}`} title="Post trip" className="absolute bottom-3 right-3 inline-flex h-14 w-20 items-center justify-center rounded-md bg-[#355650] shadow-md transition-transform hover:scale-105 [clip-path:polygon(8%_0,92%_0,100%_12%,100%_88%,92%_100%,8%_100%,0_88%,0_12%)]"><span className="flex h-11 w-16 items-center justify-center border-2 border-dashed border-[#355650] bg-[#f1e7d8]"><Image src="/brand/postcard-icon.svg" alt="" width={38} height={38} /></span><span className="sr-only">Post</span></Link>}
          </article>)}</div> : <p className="py-3 text-sm text-[#73786d]">{group.empty}</p>}
        </section>
      })}
    </section>
  </div>
}
