'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PlaceEditForm, { type PlaceEditValues, type PlaceType } from './PlaceEditForm'
import EventPhotoInput from './EventPhotoInput'
import { editPlanPlace } from '@/actions/planning'

// What the trip page knows about one of your own places, for editing it right in its popup.
export type EditablePlace = {
  id: string; type: PlaceType; name: string; city: string; status: string; day: number | null; placeId: string | null
  notes: string; tags: string[]; mealType: string; alternative: string; description: string; link: string; address: string; photos: string[]
}

// The planner's place form, inside the trip page's place popup. Day, destination and category stay as they are
// (change those in the planner).
export default function PlaceInlineEdit({ place, onDone }: { place: EditablePlace; onDone: () => void }) {
  const router = useRouter()
  const [photos, setPhotos] = useState(place.photos)
  const [placeId, setPlaceId] = useState(place.placeId ?? '')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  async function save(values: PlaceEditValues) {
    if (saving.current || uploading) return
    saving.current = true; setBusy(true); setError('')
    const data = new FormData()
    for (const [key, value] of Object.entries({ name: values.name, placeId, status: place.status, day: place.day === null ? '' : String(place.day), notes: values.notes, mealType: values.mealType,
      tags: JSON.stringify(values.tags), alternative: values.alternative, description: values.description, link: values.link, address: values.address, photos: JSON.stringify(photos) })) data.set(key, value)
    try { const result = await editPlanPlace(place.id, data); if (result.error) setError(result.error); else { router.refresh(); onDone() } }
    catch { setError('Could not save. Your changes are still here; try again.') }
    finally { saving.current = false; setBusy(false) }
  }
  return <div>
    <PlaceEditForm type={place.type} city={place.city} busy={busy || uploading} saveLabel="Save changes" showRating={false} onPlaceIdChange={setPlaceId} onClose={onDone} onSave={values => void save(values)}
      initial={{ name: place.name, mealType: place.mealType, rating: 0, notes: place.notes, tags: place.tags, isHighlight: false, alternative: place.alternative, description: place.description, link: place.link, address: place.address }}>
      <div className="space-y-1"><p className="text-xs text-muted">Photos</p><EventPhotoInput photos={photos} name={place.name} onChange={setPhotos} onBusyChange={setUploading} /></div>
    </PlaceEditForm>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>
}
