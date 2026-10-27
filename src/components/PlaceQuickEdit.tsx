'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import EventPhotoInput from './EventPhotoInput'
import { updatePlace } from '@/actions/placeQuickEdit'

// `row`: an even three-button bar under a planner card (Edit details · Add photos · Delete), with `leading` as
// the first button and `trailing` as the last. Ratings are tapped on the card itself (PlaceCardRating).
export default function PlaceQuickEdit({ itemId, name, photos, compact = false, row = false, leading, trailing }: { compact?: boolean; row?: boolean; leading?: ReactNode; trailing?: ReactNode; itemId: string; name: string; photos: string[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draftPhotos, setDraftPhotos] = useState(photos)
  const expectedPhotos = useRef(photos)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  function open() {
    setDraftPhotos(photos)
    expectedPhotos.current = photos
    setError('')
    setSaved('')
    setEditing(true)
  }

  async function save() {
    if (!editing || uploading || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const result = await updatePlace(itemId, { kind: 'photos', photos: draftPhotos, expectedPhotos: expectedPhotos.current })
      if (result.error) { setError(result.error); router.refresh(); return }
      setSaved('Photos saved.')
      setEditing(false)
      router.refresh()
    } catch { setError('Could not save. Your changes are still here; please try again.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  return <section aria-label={`Edit ${name}`} className={compact ? `text-sm ${row ? 'w-full' : ''} ${editing ? 'w-full border-t border-line-soft pt-3' : ''}` : 'mt-2 rounded-lg border border-line bg-cream p-2 text-sm'}>
    {!editing ? <>
    <div className={row ? 'grid grid-cols-3 divide-x divide-line-soft' : 'flex flex-wrap gap-2'}>
      {leading}
      <button type="button" onClick={open} aria-label={`Edit photos for ${name}`} className={`inline-flex min-h-11 items-center gap-1.5 px-2 text-link ${row ? 'justify-center text-xs sm:text-sm' : ''}`}><Camera size={16} />{photos.length ? 'Edit photos' : 'Add photos'}</button>
      {trailing}
    </div>
    </> : <>
      <p className="px-2 py-1 font-medium text-ink">Photos · {name}</p>
      <fieldset disabled={saving || uploading}>
        <EventPhotoInput photos={draftPhotos} name={name} onChange={setDraftPhotos} onBusyChange={setUploading} />
      </fieldset>
      {error && <p role="alert" className="px-2 py-1 text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" disabled={saving || uploading} onClick={() => { setEditing(false); setError('') }} className="btn btn-outline">Cancel</button>
        <button type="button" disabled={saving || uploading} onClick={() => void save()} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </>}
    {saved && !editing && <p role="status" className="px-2 text-xs text-link">{saved}</p>}
  </section>
}
