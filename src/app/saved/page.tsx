import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import ItineraryCard from '@/components/ItineraryCard'
import Link from 'next/link'
import SavedFolderGrid, { SavedFolderActions } from '@/components/SavedFolderGrid'
import SavedFolderPicker from '@/components/SavedFolderPicker'
import { tripPhotoGallery } from '@/lib/eventPhotos'

export const metadata: Metadata = { title: 'Saved — Postcard' }

// Saved: trips you've saved from others, sorted into folders.
export default async function SavedPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const { folder } = await searchParams
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fsaved')

  const [bucketItems, folders] = await Promise.all([
    prisma.bucketListItem.findMany({ where: { userId, itinerary: { visibility: { not: 'draft' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { itinerary: { include: { destinations: { orderBy: { order: 'asc' }, include: { items: true } }, photos: { orderBy: { isStock: 'asc' } }, user: { select: { id: true, name: true, image: true } }, _count: { select: { bucketedBy: true } } } } } }),
    prisma.savedFolder.findMany({ where: { userId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  // No folder chosen: the folder tiles. ?folder=all or a folder's id: that folder's trips.
  const openFolder = folder === 'all' ? { id: '', name: 'All saved' } : folders.find(f => f.id === folder)
  const savedIds = new Set(bucketItems.map(item => item.itineraryId))
  // Each folder's row shows a photo from its most recently saved trip that has one.
  const tripPhoto = (trip: (typeof bucketItems)[number]['itinerary']) => trip.coverPhoto ?? trip.photos.find(photo => !photo.isStock)?.url
    ?? trip.destinations.flatMap(destination => destination.items).flatMap(item => item.photoUrls.length ? item.photoUrls : item.photoUrl ? [item.photoUrl] : [])[0]
    ?? trip.photos[0]?.url ?? null
  const firstPhoto = (items: typeof bucketItems) => items.map(item => tripPhoto(item.itinerary)).find(Boolean) ?? null
  if (!openFolder) return <div className="page-wrap">
    <SavedFolderGrid total={bucketItems.length} allPhoto={firstPhoto(bucketItems)} folders={folders.map(f => {
      const inFolder = bucketItems.filter(item => item.folderId === f.id)
      return { ...f, count: inFolder.length, photo: firstPhoto(inFolder) }
    })} />
  </div>
  const selectedFolder = openFolder.id
  const visibleItems = bucketItems.filter(item => !selectedFolder || item.folderId === selectedFolder)

  return <div className="mx-auto max-w-xl px-5 pb-10 pt-6 sm:px-8">
    <Link href="/saved" className="text-sm text-ink-soft hover:underline">← All folders</Link>
    <h1 className="type-display mt-3 [overflow-wrap:anywhere]">{openFolder.name}</h1>
    <p className="mb-3 mt-1 text-xs uppercase tracking-label text-muted">{visibleItems.length} {visibleItems.length === 1 ? 'trip' : 'trips'}</p>
    {selectedFolder && <SavedFolderActions key={selectedFolder} folder={openFolder} />}
    {visibleItems.length === 0 ? <div className="rounded-xl border border-sand bg-cream p-8 text-center text-sm text-brown">{selectedFolder ? 'No trips in this folder yet. Use Save to folder on a saved trip.' : 'Nothing saved yet. Tap the ❤️ on any trip to save it.'}</div>
      : <div className="flex flex-col gap-3 sm:gap-5">{visibleItems.map(item => <div key={item.id} className="min-w-0">
        <ItineraryCard fullWidth id={item.itinerary.id} postType={item.itinerary.postType} tags={item.itinerary.tags} durationDays={item.itinerary.durationDays} title={item.itinerary.title} bestMonths={item.itinerary.bestMonths} datesFlexible={item.itinerary.datesFlexible} startDate={item.itinerary.startDate} endDate={item.itinerary.endDate} audience={item.itinerary.audience} budget={item.itinerary.budget} tripRating={item.itinerary.tripRating} authorName={item.itinerary.user.name} authorImage={item.itinerary.user.image} authorId={item.itinerary.user.id} destinations={item.itinerary.destinations} coverPhoto={item.itinerary.coverPhoto ?? item.itinerary.photos[0]?.url ?? null} photos={tripPhotoGallery(item.itinerary.photos, item.itinerary.destinations.flatMap(destination => destination.items), item.itinerary.coverPhoto)} currentUserId={userId} isOwn={item.itinerary.user.id === userId} isBucketed={savedIds.has(item.itinerary.id)} saveCount={item.itinerary._count.bucketedBy} />
        <div className="mt-3"><SavedFolderPicker itineraryId={item.itinerary.id} label={folders.find(f => f.id === item.folderId)?.name ?? 'Save to folder'} /></div>
      </div>)}</div>}
  </div>
}
