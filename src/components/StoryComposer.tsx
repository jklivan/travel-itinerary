'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { X, Check } from 'lucide-react'
import { postStory, storySources } from '@/actions/stories'
import EventPhotoInput from './EventPhotoInput'
import styles from './Stories.module.css'

type Sources = Awaited<ReturnType<typeof storySources>>
export default function StoryComposer({ onClose, onPosted, initialItemId }: { onClose: () => void; onPosted: () => void; initialItemId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const clientId = useRef('')
  const saving = useRef(false)
  const [sources, setSources] = useState<Sources | null>(null)
  const [tripId, setTripId] = useState('')
  const [itemId, setItemId] = useState('')
  const [photo, setPhoto] = useState('')
  const [uploaded, setUploaded] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const trip = sources?.trips.find(trip => trip.id === tripId)
  const place = trip?.places.find(place => place.id === itemId)
  const photos = [...new Set([...(place?.photos ?? []), ...(trip?.photos ?? []), ...uploaded])]

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
        : result.trips[0]
      const selectedPlace = selectedTrip?.places.find(place => place.id === initialItemId)
      setTripId(selectedTrip?.id ?? '')
      setItemId(selectedPlace?.id ?? '')
      setPhoto(selectedPlace?.photos[0] ?? (selectedPlace ? selectedTrip?.photos[0] ?? '' : ''))
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
      if (saving.current || uploading || !place || !photo) return
      saving.current = true; setBusy(true); setError('')
      if (!clientId.current) clientId.current = crypto.randomUUID()
      try {
        const result = await postStory({ id: clientId.current, itemId: place.id, photoUrl: photo, caption })
        if (result.error) setError(result.error)
        else onPosted()
      } catch { setError('Could not post. Your photo and caption are still here; please try again.') }
      finally { saving.current = false; setBusy(false) }
    }}>
      {!sources && !error && <p role="status" className={styles.empty}>Loading your places…</p>}
      {sources && !sources.trips.length && !error && <p className={styles.empty}>Add a place to a trip first. <Link href="/plan">Start planning →</Link></p>}
      {!!sources?.trips.length && <fieldset disabled={busy || uploading} className={styles.fields}>
        <label>Your trip<select value={tripId} onChange={event => { setTripId(event.target.value); setItemId(''); setPhoto(''); setUploaded([]) }}>{sources.trips.map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
        <label>Choose a place or transport<select required value={itemId} onChange={event => selectPlace(event.target.value)}><option value="">Hotel, restaurant, activity, or transport…</option>{trip?.places.map(place => <option key={place.id} value={place.id}>{place.name} · {place.type === 'transport' ? 'Transport · ' : ''}{place.destination}</option>)}</select></label>
        {place && <>
          <div><p className={styles.fieldLabel}>Choose one photo</p>{photos.length > 0 && <div className={styles.photoChoices}>{photos.map((url, index) => <button key={url} type="button" aria-label={`Choose photo ${index + 1}`} aria-pressed={photo === url} onClick={() => setPhoto(url)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" />{photo === url && <span><Check size={14} /></span>}
          </button>)}</div>}
          </div>
          <EventPhotoInput photos={uploaded} name="your story" onBusyChange={setUploading} onChange={values => { setUploaded(values); setPhoto(values.at(-1) ?? place.photos[0] ?? trip?.photos[0] ?? '') }} />
          <label>Caption <span>(optional)</span><textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={500} rows={3} placeholder="A little moment worth sharing…" /></label>
          {photo && <div className={styles.preview}><div className={styles.paper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={`Story preview for ${place.name}`} /><h3>{place.name}</h3><p>{place.destination}</p>{caption && <p className={styles.caption}>{caption}</p>}
          </div></div>}
          <p className={styles.privacy}>This photo will also be saved to {place.name} in your trip.</p>
          <p className={styles.privacy}>{sources.isPrivate ? 'Visible to your accepted followers' : 'Visible to everyone'} for 24 hours. Only this place, photo, and caption are shared. Your private trip stays private.</p>
          <button type="submit" className={styles.post} disabled={!photo || busy || uploading}>{busy ? 'Posting…' : 'Post for 24 hours'}</button>
        </>}
      </fieldset>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
  </dialog>
}
