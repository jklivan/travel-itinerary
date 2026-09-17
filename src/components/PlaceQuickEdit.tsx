'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Star, Plus } from 'lucide-react'
import StoryComposer from './StoryComposer'
import EventPhotoInput from './EventPhotoInput'
import { updatePlace } from '@/actions/placeQuickEdit'

export default function PlaceQuickEdit({ itemId, name, rating, photos, compact = false }: { compact?: boolean; itemId: string; name: string; rating: number | null; photos: string[] }) {
  const router = useRouter()
  const [postingMoment, setPostingMoment] = useState(false)
  const [mode, setMode] = useState<'photos' | 'rating' | null>(null)
  const [draftRating, setDraftRating] = useState(rating ?? 0)
  const [draftPhotos, setDraftPhotos] = useState(photos)
  const expectedPhotos = useRef(photos)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  function open(next: 'photos' | 'rating') {
    setDraftRating(rating ?? 0)
    setDraftPhotos(photos)
    expectedPhotos.current = photos
    setError('')
    setSaved('')
    setMode(next)
  }

  async function save() {
    if (!mode || uploading || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const result = await updatePlace(itemId, mode === 'rating'
        ? { kind: 'rating', rating: draftRating }
        : { kind: 'photos', photos: draftPhotos, expectedPhotos: expectedPhotos.current })
      if (result.error) { setError(result.error); router.refresh(); return }
      setSaved(mode === 'rating' ? 'Rating saved.' : 'Photos saved.')
      setMode(null)
      router.refresh()
    } catch { setError('Could not save. Your changes are still here; please try again.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  return <section aria-label={`Edit ${name}`} className={compact ? `text-sm ${mode ? 'w-full border-t border-[#e3dfd2] pt-3' : ''}` : 'mt-2 rounded-lg border border-[#d7cebc] bg-[#faf7ee] p-2 text-sm'}>
    {!mode ? <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => open('photos')} aria-label={`Edit photos for ${name}`} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[#507c76]"><Camera size={15} />{photos.length ? 'Edit photos' : 'Add photos'}</button>
      <button type="button" onClick={() => open('rating')} aria-label={`Change rating for ${name}`} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[#507c76]"><Star size={15} />{rating ? 'Change rating' : 'Add rating'}</button>
      <button type="button" onClick={() => { setSaved(''); setPostingMoment(true) }} aria-label={`Post this moment at ${name}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#c78e77] bg-[#f6e6dc] px-3 font-semibold text-[#874a35] transition-colors hover:bg-[#efd6c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#874a35]"><Plus size={15} />Post this moment</button>
    </div> : <>
      <p className="px-2 py-1 font-medium text-[#2e4147]">{mode === 'photos' ? 'Photos' : 'Your rating'} · {name}</p>
      <fieldset disabled={saving || uploading}>
        {mode === 'photos' ? <EventPhotoInput photos={draftPhotos} name={name} onChange={setDraftPhotos} onBusyChange={setUploading} /> : <div className="flex flex-wrap items-center px-1">
          {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`Rate ${name} ${value} out of 5`} aria-pressed={draftRating === value} onClick={() => setDraftRating(value)} className={`min-h-11 min-w-11 text-2xl ${value <= draftRating ? 'text-[#ba9146]' : 'text-[#8B6F4E]'}`}>★</button>)}
          <button type="button" onClick={() => setDraftRating(0)} className="min-h-11 px-2 text-xs underline">Clear rating</button>
        </div>}
      </fieldset>
      {error && <p role="alert" className="px-2 py-1 text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" disabled={saving || uploading} onClick={() => { setMode(null); setError('') }} className="min-h-11 px-3 disabled:opacity-50">Cancel</button>
        <button type="button" disabled={saving || uploading} onClick={() => void save()} className="min-h-11 rounded-lg bg-[#507c76] px-4 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </>}
    {postingMoment && <StoryComposer initialItemId={itemId} onClose={() => setPostingMoment(false)} onPosted={() => { setPostingMoment(false); setSaved('Posted to Little moments for 24 hours.'); router.refresh() }} />}
    {saved && <p role="status" className="px-2 text-xs text-[#507c76]">{saved}</p>}
  </section>
}
