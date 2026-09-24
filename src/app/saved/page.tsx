import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import ItineraryCard from '@/components/ItineraryCard'
import SavedFolders from '@/components/SavedFolders'
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
      include: { itinerary: { include: { destinations: { orderBy: { order: 'asc' }, include: { items: true } }, photos: { orderBy: { isStock: 'asc' } }, user: { select: { id: true, name: true } }, _count: { select: { bucketedBy: true } } } } } }),
    prisma.savedFolder.findMany({ where: { userId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const selectedFolder = folder && folders.some(f => f.id === folder) ? folder : ''
  const visibleItems = bucketItems.filter(item => !selectedFolder || item.folderId === selectedFolder)
  const savedIds = new Set(bucketItems.map(item => item.itineraryId))

  return <div className="mx-auto max-w-xl px-5 pb-10 pt-6 sm:px-8">
    <h1 className="font-[family-name:var(--font-playfair)] text-3xl uppercase tracking-[0.08em] text-[#2e4147]">Saved</h1>
    <p className="mb-5 mt-2 text-sm text-[#73786d]">Trips you’ve saved, sorted into folders.</p>
    <SavedFolders key={selectedFolder} userId={userId} basePath="/saved" folders={folders.map(f => ({ ...f, count: bucketItems.filter(item => item.folderId === f.id).length }))} selected={selectedFolder} total={bucketItems.length} />
    {visibleItems.length === 0 ? <div className="rounded-xl border border-[#dfd3c2] bg-[#faf7f1] p-8 text-center text-sm text-[#8B6F4E]">{selectedFolder ? 'No trips in this folder yet. Use Save to folder on a saved trip.' : 'Nothing saved yet. Tap the ❤️ on any trip to save it.'}</div>
      : <div className="flex flex-col gap-3 sm:gap-5">{visibleItems.map(item => <div key={item.id} className="min-w-0">
        <ItineraryCard fullWidth id={item.itinerary.id} postType={item.itinerary.postType} tags={item.itinerary.tags} durationDays={item.itinerary.durationDays} title={item.itinerary.title} bestMonths={item.itinerary.bestMonths} datesFlexible={item.itinerary.datesFlexible} startDate={item.itinerary.startDate} endDate={item.itinerary.endDate} audience={item.itinerary.audience} budget={item.itinerary.budget} tripRating={item.itinerary.tripRating} authorName={item.itinerary.user.name} authorId={item.itinerary.user.id} destinations={item.itinerary.destinations} coverPhoto={item.itinerary.photos[0]?.url ?? null} photos={tripPhotoGallery(item.itinerary.photos, item.itinerary.destinations.flatMap(destination => destination.items))} currentUserId={userId} isOwn={item.itinerary.user.id === userId} isBucketed={savedIds.has(item.itinerary.id)} saveCount={item.itinerary._count.bucketedBy} />
        <div className="mt-3"><SavedFolderPicker itineraryId={item.itinerary.id} label={folders.find(f => f.id === item.folderId)?.name ?? 'Save to folder'} /></div>
      </div>)}</div>}
  </div>
}
