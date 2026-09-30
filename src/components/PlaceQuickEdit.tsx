'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Star } from 'lucide-react'
import EventPhotoInput from './EventPhotoInput'
import { updatePlace } from '@/actions/placeQuickEdit'
import { StarPicker } from './ui/Stars'
import RecommendationPicker from './RecommendationPicker'
import { getRecommendation, type PlaceRecommendation } from '@/lib/placeRecommendation'

// `row`: an even three-button bar under a planner card (e.g. Edit details · Add photos · Add rating),
// with `leading` as the first button.
export default function PlaceQuickEdit({ itemId, name, type, tags, rating, photos, compact = false, row = false, leading }: { compact?: boolean; row?: boolean; leading?: ReactNode; itemId: string; name: string; type: 'hotel' | 'food_drink' | 'activity' | 'transport'; tags: string[]; rating: number | null; photos: string[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<'photos' | 'rating' | null>(null)
  const [draftRating, setDraftRating] = useState(rating ?? 0)
  const [draftRecommendation, setDraftRecommendation] = useState(getRecommendation(tags))
  const [draftPhotos, setDraftPhotos] = useState(photos)
  const expectedPhotos = useRef(photos)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  function open(next: 'photos' | 'rating') {
    setDraftRating(rating ?? 0)
    setDraftRecommendation(getRecommendation(tags))
    setDraftPhotos(photos)
    expectedPhotos.current = photos
    setError('')
    setSaved('')
    setMode(next)
  }

  // Stars and Must do / Avoid save as soon as they're tapped, so nothing is lost by moving on without a Save.
  async function saveRating(nextRating: number, nextRecommendation: PlaceRecommendation) {
    if (savingRef.current) return
    const previous = [draftRating, draftRecommendation] as const
    setDraftRating(nextRating); setDraftRecommendation(nextRecommendation)
    savingRef.current = true
    setSaving(true); setError(''); setSaved('')
    try {
      const result = await updatePlace(itemId, { kind: 'rating', rating: nextRating, recommendation: nextRecommendation })
      if (result.error) { setError(result.error); setDraftRating(previous[0]); setDraftRecommendation(previous[1]); return }
      setSaved('Saved.')
      router.refresh()
    } catch { setError('Could not save. Please try again.'); setDraftRating(previous[0]); setDraftRecommendation(previous[1]) }
    finally { savingRef.current = false; setSaving(false) }
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

  return <section aria-label={`Edit ${name}`} className={compact ? `text-sm ${row ? 'w-full' : ''} ${mode ? 'w-full border-t border-line-soft pt-3' : ''}` : 'mt-2 rounded-lg border border-line bg-cream p-2 text-sm'}>
    {!mode ? <>
    <div className={row ? 'grid grid-cols-3 divide-x divide-line-soft' : 'flex flex-wrap gap-2'}>
      {leading}
      <button type="button" onClick={() => open('photos')} aria-label={`Edit photos for ${name}`} className={`inline-flex min-h-11 items-center gap-1.5 px-2 text-link ${row ? 'justify-center text-xs sm:text-sm' : ''}`}><Camera size={15} />{photos.length ? 'Edit photos' : 'Add photos'}</button>
      <button type="button" onClick={() => open('rating')} aria-label={`Change rating for ${name}`} className={`inline-flex min-h-11 items-center gap-1.5 px-2 text-link ${row ? 'justify-center text-xs sm:text-sm' : ''}`}><Star size={15} />{rating ? 'Change rating' : 'Add rating'}</button>
    </div>
    </> : <>
      <p className="px-2 py-1 font-medium text-ink">{mode === 'photos' ? 'Photos' : 'Rating & status'} · {name}</p>
      <fieldset disabled={saving || uploading}>
        {mode === 'photos' ? <EventPhotoInput photos={draftPhotos} name={name} onChange={setDraftPhotos} onBusyChange={setUploading} /> : <div className="space-y-3 px-1">
          <div className="flex flex-wrap items-center">
            <StarPicker value={draftRating} onChange={value => void saveRating(value, draftRecommendation)} name={name} size={26} />
            {draftRating > 0 && <button type="button" onClick={() => void saveRating(0, draftRecommendation)} className="min-h-11 px-2 text-xs underline">Clear rating</button>}
          </div>
          <RecommendationPicker type={type} value={draftRecommendation} onChange={value => void saveRating(draftRating, value)} allowAlternative={false} />
        </div>}
      </fieldset>
      {error && <p role="alert" className="px-2 py-1 text-red-700">{error}</p>}
      {mode === 'rating' ? <div className="flex items-center justify-end gap-3 pt-2">
        <p role="status" className="text-xs text-link">{saving ? 'Saving…' : saved}</p>
        <button type="button" disabled={saving} onClick={() => { setMode(null); setError(''); setSaved('') }} className="min-h-11 rounded-lg bg-link px-4 text-white disabled:opacity-50">Done</button>
      </div> : <div className="flex justify-end gap-2 pt-2">
        <button type="button" disabled={saving || uploading} onClick={() => { setMode(null); setError('') }} className="min-h-11 px-3 disabled:opacity-50">Cancel</button>
        <button type="button" disabled={saving || uploading} onClick={() => void save()} className="min-h-11 rounded-lg bg-link px-4 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
      </div>}
    </>}
    {saved && !mode && <p role="status" className="px-2 text-xs text-link">{saved}</p>}
  </section>
}
