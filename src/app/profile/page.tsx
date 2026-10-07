import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ChevronRight, Settings, Users, Map } from 'lucide-react'
import ItineraryCard from '@/components/ItineraryCard'
import ProfilePhotoPicker from '@/components/ProfilePhotoPicker'
import { tripPhotoGallery } from '@/lib/eventPhotos'

export default async function ProfilePage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fprofile')
  const [user, followers, following, pending, sharedTrips] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, image: true } }),
    prisma.follow.count({ where: { followingId: userId, status: 'accepted' } }),
    prisma.follow.count({ where: { followerId: userId, status: 'accepted' } }),
    prisma.follow.count({ where: { followingId: userId, status: 'pending' } }),
    prisma.itinerary.findMany({ where: { userId, visibility: 'public' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { destinations: { orderBy: { order: 'asc' }, include: { items: true } }, photos: { orderBy: { isStock: 'asc' } }, likes: { where: { userId: userId ?? '' }, select: { id: true }, take: 1 }, _count: { select: { likes: true, bucketedBy: true } } } }),
  ])
  if (!user) redirect('/login')
  return <main className="mx-auto max-w-xl px-5 py-7 text-ink sm:px-8">
    <section className="rounded-2xl border border-mist-line bg-mist p-5">
      <div className="flex items-center gap-4">
        <ProfilePhotoPicker name={user.name} image={user.image} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-label text-link">Profile</p>
          <h1 className="type-title mt-1 break-words">{user.name}</h1>
          <p className="mt-1 text-xs text-link">{followers} followers · {following} following</p>
        </div>
        <Link href="/settings" aria-label="Settings" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-mist-line text-link hover:bg-white/60"><Settings size={19} /></Link>
      </div>
    </section>
    <div className="mt-5 space-y-3">
      <Link href="/trips" className="panel group flex min-h-20 items-center gap-4 p-4 hover:bg-paper">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Map size={22} /></span>
        <span className="min-w-0 flex-1"><span className="block font-[family-name:var(--font-playfair)] text-title">My Trips</span><span className="mt-0.5 block text-sm text-muted">View your posts and plans</span></span><ChevronRight size={20} className="text-link" />
      </Link>
      <Link href="/friends" className="panel group flex min-h-20 items-center gap-4 p-4 hover:bg-paper">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Users size={22} /></span>
        <span className="min-w-0 flex-1"><span className="block font-[family-name:var(--font-playfair)] text-title">Friends</span><span className="mt-0.5 block text-sm text-muted">{pending ? `${pending} friend request${pending === 1 ? '' : 's'} waiting` : 'Find friends & see who you follow'}</span></span>{pending > 0 && <span className="rounded-full bg-link px-2 py-1 text-xs font-semibold text-white">{pending}</span>}<ChevronRight size={20} className="text-link" />
      </Link>
      <Link href="/settings" className="panel group flex min-h-20 items-center gap-4 p-4 hover:bg-paper">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Settings size={22} /></span>
        <span className="min-w-0 flex-1"><span className="block font-[family-name:var(--font-playfair)] text-title">Settings</span><span className="mt-0.5 block text-sm text-muted">Account and notification preferences</span></span><ChevronRight size={20} className="text-link" />
      </Link>
    </div>
    <section className="mt-6" aria-labelledby="shared-trips-heading">
      <div className="mb-3"><h2 id="shared-trips-heading" className="type-title text-brown">Shared trips <span className="font-sans text-sm">({sharedTrips.length})</span></h2><p className="mt-1 text-sm text-muted">Trips you’ve published for others to explore.</p></div>
      {sharedTrips.length === 0 ? <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">No shared trips yet.</div> : <div className="space-y-4">{sharedTrips.map(it => <ItineraryCard fullWidth key={it.id} id={it.id} postType={it.postType} tags={it.tags} durationDays={it.durationDays} title={it.title} bestMonths={it.bestMonths} datesFlexible={it.datesFlexible} startDate={it.startDate} endDate={it.endDate} audience={it.audience} budget={it.budget} tripRating={it.tripRating} authorName={user.name} authorImage={user.image} authorId={user.id} destinations={it.destinations} coverPhoto={it.coverPhoto ?? it.photos[0]?.url ?? null} photos={tripPhotoGallery(it.photos, it.destinations.flatMap(destination => destination.items), it.coverPhoto)} currentUserId={userId} isOwn isBucketed={false} likeCount={it._count.likes} isLiked={it.likes.length > 0} />)}</div>}
    </section>
  </main>
}
