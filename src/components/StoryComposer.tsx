'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { X, Check } from 'lucide-react'
import { postStories, storySources } from '@/actions/stories'
import EventPhotoInput from './EventPhotoInput'
import PlacesAutocomplete from './PlacesAutocomplete'
import styles from './Stories.module.css'

type Sources = Awaited<ReturnType<typeof storySources>>
type NewStoryType = 'activity' | 'hotel' | 'food_drink' | 'transport'
export default function StoryComposer({ onClose, onPosted, initialItemId }: { onClose: () => void; onPosted: () => void; initialItemId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const clientIds = useRef<{ selection: string; ids: string[] } | null>(null)
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
  const [newPlanTitle, setNewPlanTitle] = useState('')
  // Index into the chosen trip's destinations, '' for all of them, or '__other__' to type a new one.
  const [destChoice, setDestChoice] = useState('')
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
  const [uploaded, setUploaded] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const trip = sources?.trips.find(trip => trip.id === tripId)
  const place = trip?.places.find(place => place.id === itemId)
  const addingNewPlace = mode === 'trip' && itemId === '__new__'
  const destLabel = (destination: { name: string; country: string | null }) => [destination.name, destination.country].filter(Boolean).join(', ')
  const chosenDestination = destChoice && destChoice !== '__other__' ? trip?.destinations[Number(destChoice)] : undefined
  const placesHere = destChoice === '__other__' ? [] : trip?.places.filter(place => !chosenDestination || place.destination === destLabel(chosenDestination)) ?? []
  const canCompose = mode === 'new' || !!place || addingNewPlace
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
      const defaultTrip = selectedTrip ?? result.trips[0]
      const selectedPlace = selectedTrip?.places.find(place => place.id === initialItemId)
      setTripId(defaultTrip?.id ?? '')
      setItemId(selectedPlace?.id ?? '')
      setSelectedPhotos([selectedPlace?.photos[0] ?? (selectedPlace ? selectedTrip?.photos[0] ?? '' : '')].filter(Boolean))
      if (selectedPlace) {
        setMode('trip')
        const index = selectedTrip!.destinations.findIndex(destination => [destination.name, destination.country].filter(Boolean).join(', ') === selectedPlace.destination)
        setDestChoice(index >= 0 ? String(index) : '')
      }
      if (initialItemId && !selectedPlace && !result.error) setError('This place is no longer available. Choose another place to share.')
    }).catch(() => { if (active) setError('Could not load your trips. Close this window and try again.') })
    return () => { active = false; element?.close(); if (previous !== 'hidden') document.body.style.overflow = previous }
  }, [initialItemId])

  function chooseItinerary(value: string) {
    if (value === 'new') setMode('new')
    else {
      setMode('trip'); setTripId(value)
      const destinations = sources?.trips.find(trip => trip.id === value)?.destinations ?? []
      chooseDestination(destinations.length ? '0' : '__other__', destinations)
    }
    setSelectedPhotos([]); setUploaded([]); setError(''); clientIds.current = null
  }

  function chooseDestination(value: string, destinations = trip?.destinations ?? []) {
    const destination = value && value !== '__other__' ? destinations[Number(value)] : undefined
    setDestChoice(value); setItemId(value === '__other__' ? '__new__' : '')
    setNewDestination(destination?.name ?? ''); setNewCountry(destination?.country ?? ''); setNewName(''); setNewPlaceId('')
    setSelectedPhotos([]); setUploaded([]); setError(''); clientIds.current = null
  }

  function selectPlace(id: string) {
    const selected = trip?.places.find(item => item.id === id)
    setItemId(id); setUploaded([]); setSelectedPhotos(id === '__new__' ? [] : [selected?.photos[0] ?? trip?.photos[0] ?? ''].filter(Boolean)); setError(''); clientIds.current = null
    if (id === '__new__') { setNewName(''); setNewPlaceId('') }
  }

  return <dialog ref={dialog} className={styles.composer} aria-labelledby={titleId} onClose={onClose} onCancel={event => { if (busy || uploading) event.preventDefault() }}>
    <header className={styles.composerHeader}><div><h2 id={titleId}>Your polaroid story</h2><p>Share a few trip moments. Each stays for 24 hours.</p></div><button type="button" className={styles.close} disabled={busy || uploading} aria-label="Close story composer" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
    <form onSubmit={async event => {
      event.preventDefault()
      if (saving.current || uploading || !selectedPhotos.length) return
      if (mode === 'trip' && !place && !addingNewPlace) { setError('Choose a place from your trip first.'); return }
      if (mode === 'new' || addingNewPlace) {
        const missing = [!newPlanTitle.trim() && mode === 'new' ? 'an itinerary title' : '', !newDestination.trim() ? 'a destination' : '', !newName.trim() ? 'an activity name' : ''].filter(Boolean)
        if (missing.length) { setError(`Add ${missing.join(' and ')} before posting.`); return }
      }
      saving.current = true; setBusy(true); setError('')
      if (mode === 'new' && !newPlanId.current) newPlanId.current = crypto.randomUUID()
      try {
        const selection = selectedPhotos.join('\n')
        if (!clientIds.current || clientIds.current.selection !== selection) clientIds.current = { selection, ids: selectedPhotos.map(() => crypto.randomUUID()) }
        const shared = mode === 'trip' && place
          ? { itemId: place.id, caption }
          : { placeName: newName.trim(), destination: newDestination.trim(), country: newCountry, type: newType, placeId: newPlaceId, ...(mode === 'new' ? { newPlanId: newPlanId.current, newPlanTitle } : { tripId }), caption }
        const result = await postStories({ ...shared, photos: selectedPhotos.map((photoUrl, index) => ({ id: clientIds.current!.ids[index], photoUrl })) })
        if (result.error) setError(result.error)
        else onPosted()
      } catch { setError('Could not post. Your photo and caption are still here; please try again.') }
      finally { saving.current = false; setBusy(false) }
    }}>
      {!sources && !error && <p role="status" className={styles.empty}>Loading…</p>}
      {sources && <fieldset disabled={busy || uploading} className={styles.fields}>
        {/* One choice decides the rest of the form: a new itinerary, or a place in one of your trips. */}
        <label>Itinerary<select value={mode === 'trip' ? tripId : 'new'} onChange={event => chooseItinerary(event.target.value)}><option value="new">New itinerary</option>{sources.trips.map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
        {mode === 'trip' ? <>
          <label>Destination<select value={destChoice} onChange={event => chooseDestination(event.target.value)}>{trip && trip.destinations.length > 1 && <option value="">All destinations</option>}{trip?.destinations.map((destination, index) => <option key={index} value={String(index)}>{destLabel(destination)}</option>)}<option value="__other__">Somewhere else…</option></select></label>
          {(destChoice === '__other__' || (addingNewPlace && !chosenDestination)) && <label>New destination<PlacesAutocomplete value={newDestination} onChange={value => { setNewDestination(value); setNewCountry(''); setNewPlaceId('') }} onSelect={(main, secondary) => { setNewDestination(main); setNewCountry(secondary); setNewPlaceId('') }} type="destination" required maxLength={240} placeholder="City or area" className="mt-1 block min-h-11 w-full rounded-xl border border-[#d7cebc] bg-white px-3" /></label>}
          {destChoice !== '__other__' && <label>Place<select required value={itemId} onChange={event => selectPlace(event.target.value)}><option value="">Choose a place from your plan…</option>{placesHere.map(place => <option key={place.id} value={place.id}>{place.name}{place.type === 'transport' ? ' · Transport' : ''}{chosenDestination ? '' : ` · ${place.destination}`}</option>)}<option value="__new__">＋ Something else…</option></select></label>}
          {addingNewPlace && <>
            <div><p className={styles.fieldLabel}>Category</p><div className="mt-2 flex flex-wrap gap-2">{([['activity', 'Activity'], ['hotel', 'Hotel'], ['food_drink', 'Food & drink'], ['transport', 'Transport']] as const).map(([type, label]) => <button key={type} type="button" aria-pressed={newType === type} onClick={() => { setNewType(type); setNewPlaceId('') }} className={`min-h-10 rounded-full border px-3 text-sm ${newType === type ? 'border-[#59694f] bg-[#e6ece5] text-[#2e4147]' : 'border-[#d7cebc]'}`}>{label}</button>)}</div></div>
            <label>Place name<PlacesAutocomplete value={newName} onChange={value => { setNewName(value); setNewPlaceId('') }} onSelect={(_main, _secondary, id) => setNewPlaceId(id ?? '')} type={newType === 'food_drink' ? 'restaurant' : newType === 'hotel' ? 'hotel' : 'activity'} city={[newDestination, newCountry].filter(Boolean).join(', ')} required maxLength={240} placeholder="Search or enter a name" className="mt-1 block min-h-11 w-full rounded-xl border border-[#d7cebc] bg-white px-3" /></label>
          </>}
        </> : <>
          <label>Itinerary title<input required value={newPlanTitle} onChange={event => setNewPlanTitle(event.target.value)} maxLength={160} placeholder="e.g. Weekend in Lucerne" className="mt-1 block min-h-11 w-full rounded-xl border border-[#d7cebc] bg-white px-3" /></label>
          <div><p className={styles.fieldLabel}>Category</p><div className="mt-2 flex flex-wrap gap-2">{([['activity', 'Activity'], ['hotel', 'Hotel'], ['food_drink', 'Food & drink'], ['transport', 'Transport']] as const).map(([type, label]) => <button key={type} type="button" aria-pressed={newType === type} onClick={() => { setNewType(type); setNewPlaceId('') }} className={`min-h-10 rounded-full border px-3 text-sm ${newType === type ? 'border-[#59694f] bg-[#e6ece5] text-[#2e4147]' : 'border-[#d7cebc]'}`}>{label}</button>)}</div></div>
          <label>Destination<PlacesAutocomplete value={newDestination} onChange={value => { setNewDestination(value); setNewCountry(''); setNewPlaceId('') }} onSelect={(main, secondary) => { setNewDestination(main); setNewCountry(secondary); setNewPlaceId('') }} type="destination" required maxLength={240} placeholder="City or area" className="mt-1 block min-h-11 w-full rounded-xl border border-[#d7cebc] bg-white px-3" /></label>
          <label>Activity or place name<PlacesAutocomplete value={newName} onChange={value => { setNewName(value); setNewPlaceId('') }} onSelect={(_main, _secondary, id) => setNewPlaceId(id ?? '')} type={newType === 'food_drink' ? 'restaurant' : newType === 'hotel' ? 'hotel' : 'activity'} city={[newDestination, newCountry].filter(Boolean).join(', ')} required maxLength={240} placeholder="Search or enter a name" className="mt-1 block min-h-11 w-full rounded-xl border border-[#d7cebc] bg-white px-3" /></label>
        </>}
        {canCompose && <>
          <div><p className={styles.fieldLabel}>Choose photos <span>(up to 10)</span></p>{photos.length > 0 && <div className={styles.photoChoices}>{photos.map((url, index) => <button key={url} type="button" aria-label={`${selectedPhotos.includes(url) ? 'Remove' : 'Choose'} photo ${index + 1}`} aria-pressed={selectedPhotos.includes(url)} onClick={() => {
            if (!selectedPhotos.includes(url) && selectedPhotos.length >= 10) { setError('You can post up to 10 photos at a time.'); return }
            setSelectedPhotos(current => current.includes(url) ? current.filter(value => value !== url) : [...current, url])
            setError('')
            clientIds.current = null
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" />{selectedPhotos.includes(url) && <span><Check size={14} /></span>}
          </button>)}</div>}
          </div>
          <EventPhotoInput showThumbnails={false} photos={uploaded} name="your story" onBusyChange={setUploading} onChange={values => { setUploaded(values); setSelectedPhotos(values.slice(0, 10)); clientIds.current = null; setError(values.length > 10 ? 'You can post up to 10 photos at a time.' : '') }} />
          <label>Caption <span>(optional)</span><textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={500} rows={3} placeholder="A snapshot worth sharing…" /></label>
          {selectedPhotos[0] && <div className={styles.preview}><div className={styles.paper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedPhotos[0]} alt={`Story preview for ${mode === 'trip' && place ? place.name : newName}`} /><h3>{mode === 'trip' && place ? place.name : newName}</h3><p>{mode === 'trip' && place ? place.destination : [newDestination, newCountry].filter(Boolean).join(', ')}</p>{caption && <p className={styles.caption}>{caption}</p>}{selectedPhotos.length > 1 && <p className={styles.caption}>+ {selectedPhotos.length - 1} more story photos</p>}
          </div></div>}
          <p className={styles.privacy}>{mode === 'trip' && place ? `${selectedPhotos.length} photo${selectedPhotos.length === 1 ? '' : 's'} will also be saved to ${place.name} in your trip.` : `This activity and ${selectedPhotos.length} photo${selectedPhotos.length === 1 ? '' : 's'} will be added to ${mode === 'new' ? newPlanTitle || 'your new private itinerary' : 'your itinerary'}.`}</p>
          <p className={styles.privacy}>{sources.isPrivate ? 'Visible to your accepted followers' : 'Visible to everyone'} for 24 hours.</p>
          <button type="submit" className={styles.post} disabled={!selectedPhotos.length || selectedPhotos.length > 10 || !canCompose || busy || uploading}>{busy ? 'Posting…' : `Post ${selectedPhotos.length > 1 ? `${selectedPhotos.length} photos` : 'for 24 hours'}`}</button>
        </>}
      </fieldset>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
  </dialog>
}
