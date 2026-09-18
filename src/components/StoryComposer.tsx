'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { X, Check } from 'lucide-react'
import { postStory, storySources } from '@/actions/stories'
import EventPhotoInput from './EventPhotoInput'
import PlacesAutocomplete from './PlacesAutocomplete'
import styles from './Stories.module.css'

type Sources = Awaited<ReturnType<typeof storySources>>
type NewStoryType = 'activity' | 'hotel' | 'food_drink' | 'transport'
export default function StoryComposer({ onClose, onPosted, initialItemId }: { onClose: () => void; onPosted: () => void; initialItemId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const clientId = useRef('')
  const saving = useRef(false)
  const newPlanId = useRef('')
  const [sources, setSources] = useState<Sources | null>(null)
  const [mode, setMode] = useState<'new' | 'trip'>('new')
  const [tripId, setTripId] = useState('')
  const [itemId, setItemId] = useState('')
  const [newName, setNewName] = useState('')
  const [newDestination, setNewDestination] = useState('')
  const [newCountry, setNewCountry] = useState('')
  const [newType, setNewType] = useState<NewStoryType>('activity')
  const [newPlaceId, setNewPlaceId] = useState('')
  const [activityPlan, setActivityPlan] = useState('new')
  const [newPlanTitle, setNewPlanTitle] = useState('')
  const [photo, setPhoto] = useState('')
  const [uploaded, setUploaded] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const trip = sources?.trips.find(trip => trip.id === tripId)
  const place = trip?.places.find(place => place.id === itemId)
  const photos = [...new Set([...(mode === 'trip' ? place?.photos ?? [] : []), ...(mode === 'trip' ? trip?.photos ?? [] : []), ...uploaded])]

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    if (previous !== 'hidden') document.body.style.overflow = 'hidden'
    let active = true
    void storySources().then(result => {
      if (!active) return
      setSources(result)
      if (result.error) setError(result.error)
      const selectedTrip = initialItemId
        ? result.trips.find(trip => trip.places.some(place => place.id === initialItemId))
        : undefined
      const selectedPlace = selectedTrip?.places.find(place => place.id === initialItemId)
      setTripId(selectedTrip?.id ?? '')
      setItemId(selectedPlace?.id ?? '')
      setPhoto(selectedPlace?.photos[0] ?? (selectedPlace ? selectedTrip?.photos[0] ?? '' : ''))
      if (selectedPlace) setMode('trip')
      if (initialItemId && !selectedPlace && !result.error) setError('This place is no longer available. Choose another place to share.')
    }).catch(() => { if (active) setError('Could not load your trips. Close this window and try again.') })
    return () => { active = false; element?.close(); if (previous !== 'hidden') document.body.style.overflow = previous }
  }, [initialItemId])

  function selectPlace(id: string) {
    const selected = trip?.places.find(item => item.id === id)
    setItemId(id); setUploaded([]); setPhoto(selected?.photos[0] ?? trip?.photos[0] ?? ''); setError('')
  }

  return <dialog ref={dialog} className={styles.composer} aria-labelledby={titleId} onClose={onClose} onCancel={event => { if (busy || uploading) event.preventDefault() }}>
    <header className={styles.composerHeader}><div><h2 id={titleId}>Your polaroid story</h2><p>One trip moment. Here for 24 hours.</p></div><button type="button" className={styles.close} disabled={busy || uploading} aria-label="Close story composer" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
    <form onSubmit={async event => {
      event.preventDefault()
      if (saving.current || uploading || !photo || (mode === 'trip' && !place) || (mode === 'new' && (!newName.trim() || !newDestination.trim() || (activityPlan === 'new' && !newPlanTitle.trim())))) return
      saving.current = true; setBusy(true); setError('')
      if (!clientId.current) clientId.current = crypto.randomUUID()
      if (mode === 'new' && activityPlan === 'new' && !newPlanId.current) newPlanId.current = crypto.randomUUID()
      try {
        const result = await postStory(mode === 'trip'
          ? { id: clientId.current, itemId: place!.id, photoUrl: photo, caption }
          : { id: clientId.current, placeName: newName.trim(), destination: newDestination.trim(), country: newCountry, type: newType, placeId: newPlaceId, ...(activityPlan === 'new' ? { newPlanId: newPlanId.current, newPlanTitle } : { tripId: activityPlan }), photoUrl: photo, caption })
        if (result.error) setError(result.error)
        else onPosted()
      } catch { setError('Could not post. Your photo and caption are still here; please try again.') }
      finally { saving.current = false; setBusy(false) }
    }}>
      {!sources && !error && <p role="status" className={styles.empty}>Loading…</p>}
      {sources && <fieldset disabled={busy || uploading} className={styles.fields}>
        <div className="flex gap-2" role="tablist" aria-label="Moment source">
          <button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => { setMode('new'); setPhoto(''); setUploaded([]); setError('') }} className={`min-h-11 flex-1 rounded-full border px-3 text-sm ${mode === 'new' ? 'border-[#59694f] bg-[#e6ece5] text-[#2e4147]' : 'border-[#d7cebc]'}`}>New activity</button>
          {!!sources.trips.length && <button type="button" role="tab" aria-selected={mode === 'trip'} onClick={() => { setMode('trip'); setPhoto(''); setUploaded([]); setError('') }} className={`min-h-11 flex-1 rounded-full border px-3 text-sm ${mode === 'trip' ? 'border-[#59694f] bg-[#e6ece5] text-[#2e4147]' : 'border-[#d7cebc]'}`}>From a trip</button>}
        </div>
        {mode === 'trip' ? <>
          <label>Your trip<select value={tripId} onChange={event => { setTripId(event.target.value); setItemId(''); setPhoto(''); setUploaded([]) }}>{sources.trips.map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
          <label>Choose a place or transport<select required value={itemId} onChange={event => selectPlace(event.target.value)}><option value="">Hotel, restaurant, activity, or transport…</option>{trip?.places.map(place => <option key={place.id} value={place.id}>{place.name} · {place.type === 'transport' ? 'Transport · ' : ''}{place.destination}</option>)}</select></label>
        </> : <>
          <div><p className={styles.fieldLabel}>Category</p><div className="mt-2 flex flex-wrap gap-2">{([['activity', 'Activity'], ['hotel', 'Hotel'], ['food_drink', 'Food & drink'], ['transport', 'Transport']] as const).map(([type, label]) => <button key={type} type="button" aria-pressed={newType === type} onClick={() => { setNewType(type); setNewPlaceId('') }} className={`min-h-10 rounded-full border px-3 text-sm ${newType === type ? 'border-[#59694f] bg-[#e6ece5] text-[#2e4147]' : 'border-[#d7cebc]'}`}>{label}</button>)}</div></div>
          <label>Itinerary<select value={activityPlan} onChange={event => setActivityPlan(event.target.value)}><option value="new">New itinerary</option>{sources.trips.filter(trip => trip.isPlan).map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
          {activityPlan === 'new' && <label>Itinerary title<input required value={newPlanTitle} onChange={event => setNewPlanTitle(event.target.value)} maxLength={160} placeholder="e.g. Weekend in Lucerne" className="mt-1 block min-h-11 w-full rounded-xl border border-[#d7cebc] bg-white px-3" /></label>}
          <label>Destination<PlacesAutocomplete value={newDestination} onChange={value => { setNewDestination(value); setNewCountry(''); setNewPlaceId('') }} onSelect={(main, secondary) => { setNewDestination(main); setNewCountry(secondary); setNewPlaceId('') }} type="destination" required maxLength={240} placeholder="City or area" className="mt-1 block min-h-11 w-full rounded-xl border border-[#d7cebc] bg-white px-3" /></label>
          <label>Activity or place name<PlacesAutocomplete value={newName} onChange={value => { setNewName(value); setNewPlaceId('') }} onSelect={(_main, _secondary, id) => setNewPlaceId(id ?? '')} type={newType === 'food_drink' ? 'restaurant' : newType === 'hotel' ? 'hotel' : 'activity'} city={[newDestination, newCountry].filter(Boolean).join(', ')} required maxLength={240} placeholder="Search or enter a name" className="mt-1 block min-h-11 w-full rounded-xl border border-[#d7cebc] bg-white px-3" /></label>
        </>}
        {(mode === 'trip' ? !!place : true) && <>
          <div><p className={styles.fieldLabel}>Choose one photo</p>{photos.length > 0 && <div className={styles.photoChoices}>{photos.map((url, index) => <button key={url} type="button" aria-label={`Choose photo ${index + 1}`} aria-pressed={photo === url} onClick={() => setPhoto(url)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" />{photo === url && <span><Check size={14} /></span>}
          </button>)}</div>}
          </div>
          <EventPhotoInput photos={uploaded} name="your story" onBusyChange={setUploading} onChange={values => { setUploaded(values); setPhoto(values.at(-1) ?? (mode === 'trip' ? place?.photos[0] ?? trip?.photos[0] : '') ?? '') }} />
          <label>Caption <span>(optional)</span><textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={500} rows={3} placeholder="A little moment worth sharing…" /></label>
          {photo && <div className={styles.preview}><div className={styles.paper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={`Story preview for ${mode === 'trip' ? place?.name : newName}`} /><h3>{mode === 'trip' ? place?.name : newName}</h3><p>{mode === 'trip' ? place?.destination : [newDestination, newCountry].filter(Boolean).join(', ')}</p>{caption && <p className={styles.caption}>{caption}</p>}
          </div></div>}
          <p className={styles.privacy}>{mode === 'trip' ? `This photo will also be saved to ${place?.name} in your trip.` : `This activity and photo will be added to ${activityPlan === 'new' ? newPlanTitle || 'your new private itinerary' : 'your itinerary'}.`}</p>
          <p className={styles.privacy}>{sources.isPrivate ? 'Visible to your accepted followers' : 'Visible to everyone'} for 24 hours. Only this place, photo, and caption are shown in the moment.</p>
          <button type="submit" className={styles.post} disabled={!photo || (mode === 'trip' ? !place : !newName.trim() || !newDestination.trim() || (activityPlan === 'new' && !newPlanTitle.trim())) || busy || uploading}>{busy ? 'Posting…' : 'Post for 24 hours'}</button>
        </>}
      </fieldset>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
  </dialog>
}
