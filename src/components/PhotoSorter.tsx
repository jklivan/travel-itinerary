'use client'

import { useContext, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ImagePlus, Maximize2, X } from 'lucide-react'
import { updatePlace } from '@/actions/placeQuickEdit'
import { addToPhotoPile, takeFromPhotoPile } from '@/actions/tripPhotoPile'
import { eventPhotos } from '@/lib/eventPhotos'
import { sizedPhoto } from '@/lib/photoSizing'
import { uploadFailureMessage, uploadPhotos } from '@/lib/uploadPhotos'
import GooglePhotosButton from './GooglePhotosButton'
import PhotoViewer from './ui/PhotoViewer'
import { canPickTripPhotos, TripDates } from '@/lib/tripPhotos'
import TripPhotoPicker from './TripPhotoPicker'

type SortPlace = { id: string; name: string; type: string; photos: string[]; destinationName: string }
const CATEGORY: Record<string, string> = { hotel: 'Accommodation', food_drink: 'Restaurants', activity: 'Activities', transport: 'Transportation' }

// Add a whole trip's photos at once (one trip to the album), then tap them into places: select photos, tap the place,
// and they leave the pile. In the iPhone app, a dated trip's photos come straight from the trip's dates.
// startOpen/onClose: opened from a link elsewhere (the planner's "Add trip photos" beside Edit), closed by its own X.
// Photos not tapped into a place yet are kept on the trip (actions/tripPhotoPile), so the pile comes back next time:
// initialPile is those photos.
export default function PhotoSorter({ tripId, places, initialPile = [], prompt = '', startOpen = false, onClose }: { tripId: string; places: SortPlace[]; initialPile?: string[]; prompt?: string; startOpen?: boolean; onClose?: () => void }) {
  const router = useRouter()
  const [open, setOpenState] = useState(startOpen)
  const setOpen = (value: boolean) => { setOpenState(value); if (!value) onClose?.() }
  const [pile, setPile] = useState<string[]>(initialPile)
  const [selected, setSelected] = useState<string[]>([])
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // Each place's photos as saved so far, so several additions to one place build on each other.
  const [saved, setSaved] = useState<Record<string, string[]>>({})
  const destinations = [...new Set(places.map(place => place.destinationName))]
  // In the iPhone app on a dated trip, Choose photos opens the photos taken on the trip; Other photos… is the usual picker.
  const tripDates = useContext(TripDates)
  const [pickingTrip, setPickingTrip] = useState(false)
  // A pile photo shown full screen.
  const [viewing, setViewing] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function choose(files: File[]) {
    if (!files.length) return
    setError(''); setMessage(''); setProgress(`Uploading 0 of ${files.length}…`)
    const { urls, failed, reason } = await uploadPhotos(files, done => setProgress(`Uploading ${done} of ${files.length}…`))
    setPile(current => [...current, ...urls])
    // Kept on the trip straight away, so closing this or adding places first doesn't lose them.
    if (urls.length) { setProgress('Saving…'); const kept = await addToPhotoPile(tripId, urls).catch(() => ({ error: 'x' })); if (kept.error) setError('Your photos uploaded but couldn’t be saved to the trip yet. Tap them into places before closing.') }
    setProgress('')
    if (failed) setError(uploadFailureMessage(failed, reason))
  }
  async function addTo(place: SortPlace) {
    if (!selected.length || progress) return
    const current = saved[place.id] ?? place.photos
    const next = eventPhotos([...current, ...selected])
    setProgress('Saving…'); setError('')
    try {
      const result = await updatePlace(place.id, { kind: 'photos', photos: next, expectedPhotos: current })
      if (result?.error) { setError(result.error); return }
      setSaved(previous => ({ ...previous, [place.id]: next }))
      const moved = selected
      setPile(previous => previous.filter(url => !moved.includes(url)))
      await takeFromPhotoPile(tripId, moved).catch(() => {})
      setMessage(`Added ${selected.length} photo${selected.length === 1 ? '' : 's'} to ${place.name}.`)
      setSelected([])
      router.refresh()
    } catch { setError('Could not save. Please try again.') } finally { setProgress('') }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mb-5 flex w-full items-center gap-3 rounded-xl border border-dashed border-link p-3 text-left text-sm text-link hover:bg-mist">
    <ImagePlus size={18} className="shrink-0" /><span><span className="font-semibold">Add your trip photos</span><span className="block text-xs text-muted">{pile.length ? `${pile.length} photo${pile.length === 1 ? '' : 's'} waiting to be tapped into places` : prompt}</span></span>
  </button>

  return <section aria-label="Sort trip photos into places" className="panel mb-6 space-y-4 p-4">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="type-title">Add your trip photos</h2><p className="type-meta mt-1">Choose all the photos from this trip at once, then select some and tap the place they belong to.</p></div>
      <button type="button" aria-label="Close" disabled={!!progress} onClick={() => setOpen(false)} className="flex size-10 shrink-0 items-center justify-center rounded-full"><X size={18} /></button>
    </div>
    <label onClick={event => { if (event.target !== fileInput.current && canPickTripPhotos() && !progress) { event.preventDefault(); setPickingTrip(true) } }} className={`btn btn-outline btn-sm ${progress ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
      <ImagePlus size={16} />{pile.length ? 'Add more photos' : 'Choose photos'}
      <input ref={fileInput} type="file" multiple accept="image/*" className="sr-only" disabled={!!progress} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void choose(files) }} />
    </label>
    {/* Or from Google Photos (people who keep their photos there, not on the phone). */}
    <GooglePhotosButton tripId={tripId} disabled={!!progress} onAdded={urls => { setPile(current => [...current, ...urls]); if (urls.length) { setMessage(`Added ${urls.length} photo${urls.length === 1 ? '' : 's'} from Google Photos.`); router.refresh() } }} />
    {pickingTrip && <TripPhotoPicker start={tripDates?.start} end={tripDates?.end} name="this trip" onPick={files => void choose(files)} onFallback={() => fileInput.current?.click()} onClose={() => setPickingTrip(false)} />}
    {progress && <p role="status" className="type-body text-link">{progress}</p>}
    {message && <p role="status" className="flex items-center gap-1.5 text-sm text-link"><Check size={16} />{message}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {pile.length > 0 && <>
      <div className="flex items-center justify-between gap-2"><p className="type-label">{pile.length} to sort{selected.length ? ` · ${selected.length} selected` : ''}</p>
        <div className="flex items-center gap-4">
          {/* Added one by mistake: take the selected ones out of the pile (they aren't saved anywhere yet). */}
          {selected.length > 0 && <button type="button" disabled={!!progress} onClick={() => { const removed = selected; setPile(current => current.filter(url => !removed.includes(url))); void takeFromPhotoPile(tripId, removed).catch(() => {}); setMessage(`Removed ${removed.length} photo${removed.length === 1 ? '' : 's'}.`); setSelected([]) }} className="text-xs font-semibold text-danger">Remove</button>}
          <button type="button" onClick={() => setSelected(selected.length === pile.length ? [] : pile)} className="text-xs font-semibold text-link">{selected.length === pile.length ? 'Clear' : 'Select all'}</button>
        </div></div>
      <div className="grid grid-cols-4 gap-1">{pile.map((url, index) => { const on = selected.includes(url); return <div key={url} className="relative">
        <button type="button" aria-pressed={on} aria-label={`Photo ${index + 1}`} onClick={() => setSelected(current => on ? current.filter(item => item !== url) : [...current, url])} className="relative block aspect-square w-full overflow-hidden bg-chip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sizedPhoto(url, 256)} alt="" className={`size-full object-cover ${on ? 'opacity-80' : ''}`} />
          {on && <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-link text-white ring-2 ring-white"><Check size={14} /></span>}
        </button>
        {/* Tapping a photo selects it; this shows it full screen. */}
        <button type="button" onClick={() => setViewing(index)} aria-label={`See photo ${index + 1} larger`} className="absolute bottom-1 left-1 flex size-7 items-center justify-center rounded-full bg-ink/60 text-white"><Maximize2 size={14} /></button>
      </div> })}</div>
      {viewing !== null && <PhotoViewer photos={pile} start={viewing} name="Trip photo" onClose={() => setViewing(null)} />}
      {/* No places yet: the photos wait here (kept on the trip) until there are places to tap them into. */}
      {!places.length && <p className="panel-hint p-3 text-sm text-ink">Your photos are saved to this trip. Add your places, then come back here to tap them into each one.</p>}
      {/* The places, by destination and category: tapping one adds the selected photos to it. */}
      {places.length > 0 && <div className="panel-inset space-y-3 p-3">
        <p className="type-label">{selected.length ? `Add ${selected.length} photo${selected.length === 1 ? '' : 's'} to…` : 'Select photos, then tap a place'}</p>
        {destinations.map(destination => <div key={destination} className="space-y-2">
          {destinations.length > 1 && <p className="type-meta">{destination}</p>}
          {Object.entries(CATEGORY).map(([type, label]) => { const here = places.filter(place => place.destinationName === destination && place.type === type); return here.length > 0 && <div key={type}>
            <p className="type-micro mb-1 text-muted">{label}</p>
            <div className="flex flex-wrap gap-1.5">{here.map(place => <button key={place.id} type="button" disabled={!selected.length || !!progress} onClick={() => void addTo(place)} className="chip">{place.name}{(saved[place.id] ?? place.photos).length > 0 && <span className="text-muted">· {(saved[place.id] ?? place.photos).length}</span>}</button>)}</div>
          </div> })}
        </div>)}
      </div>}
    </>}
    {!pile.length && !progress && Object.keys(saved).length > 0 && <p className="type-body">All sorted. <button type="button" onClick={() => setOpen(false)} className="text-link underline">Done</button></p>}
  </section>
}
