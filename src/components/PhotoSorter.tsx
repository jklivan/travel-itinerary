'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ImagePlus, X } from 'lucide-react'
import { updatePlace } from '@/actions/placeQuickEdit'
import { eventPhotos } from '@/lib/eventPhotos'
import { sizedPhoto } from '@/lib/photoSizing'
import { uploadPhotos } from '@/lib/uploadPhotos'

type SortPlace = { id: string; name: string; type: string; photos: string[]; destinationName: string }
const CATEGORY: Record<string, string> = { hotel: 'Accommodation', food_drink: 'Restaurants', activity: 'Activities', transport: 'Transportation' }

// Add a whole trip's photos at once (one trip to the album), then tap them into places: select photos, tap the place,
// and they leave the pile. For trips without dates, where the iPhone app can't show the trip's photos for each place.
export default function PhotoSorter({ places, prompt }: { places: SortPlace[]; prompt: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pile, setPile] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // Each place's photos as saved so far, so several additions to one place build on each other.
  const [saved, setSaved] = useState<Record<string, string[]>>({})
  const destinations = [...new Set(places.map(place => place.destinationName))]

  async function choose(files: File[]) {
    if (!files.length) return
    setError(''); setMessage(''); setProgress(`Uploading 0 of ${files.length}…`)
    const { urls, failed } = await uploadPhotos(files, done => setProgress(`Uploading ${done} of ${files.length}…`))
    setPile(current => [...current, ...urls]); setProgress('')
    if (failed) setError(`${failed} photo${failed === 1 ? '' : 's'} couldn’t be uploaded (files must be under 10 MB).`)
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
      setPile(previous => previous.filter(url => !selected.includes(url)))
      setMessage(`Added ${selected.length} photo${selected.length === 1 ? '' : 's'} to ${place.name}.`)
      setSelected([])
      router.refresh()
    } catch { setError('Could not save. Please try again.') } finally { setProgress('') }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mb-5 flex w-full items-center gap-3 rounded-xl border border-dashed border-link p-3 text-left text-sm text-link hover:bg-mist">
    <ImagePlus size={18} className="shrink-0" /><span><span className="font-semibold">Add your trip photos</span><span className="block text-xs text-muted">{prompt}</span></span>
  </button>

  return <section aria-label="Sort trip photos into places" className="panel mb-6 space-y-4 p-4">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="type-title">Add your trip photos</h2><p className="type-meta mt-1">Choose all the photos from this trip at once, then select some and tap the place they belong to.</p></div>
      <button type="button" aria-label="Close" disabled={!!progress} onClick={() => setOpen(false)} className="flex size-10 shrink-0 items-center justify-center rounded-full"><X size={18} /></button>
    </div>
    <label className={`btn btn-outline btn-sm ${progress ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
      <ImagePlus size={16} />{pile.length ? 'Add more photos' : 'Choose photos'}
      <input type="file" multiple accept="image/*" className="sr-only" disabled={!!progress} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void choose(files) }} />
    </label>
    {progress && <p role="status" className="type-body text-link">{progress}</p>}
    {message && <p role="status" className="flex items-center gap-1.5 text-sm text-link"><Check size={16} />{message}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {pile.length > 0 && <>
      <div className="flex items-center justify-between gap-2"><p className="type-label">{pile.length} to sort{selected.length ? ` · ${selected.length} selected` : ''}</p>
        <button type="button" onClick={() => setSelected(selected.length === pile.length ? [] : pile)} className="text-xs font-semibold text-link">{selected.length === pile.length ? 'Clear' : 'Select all'}</button></div>
      <div className="grid grid-cols-4 gap-1">{pile.map((url, index) => { const on = selected.includes(url); return <button key={url} type="button" aria-pressed={on} aria-label={`Photo ${index + 1}`} onClick={() => setSelected(current => on ? current.filter(item => item !== url) : [...current, url])} className="relative aspect-square overflow-hidden bg-chip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sizedPhoto(url, 256)} alt="" className={`size-full object-cover ${on ? 'opacity-80' : ''}`} />
        {on && <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-link text-white ring-2 ring-white"><Check size={14} /></span>}
      </button> })}</div>
      {/* The places, by destination and category: tapping one adds the selected photos to it. */}
      <div className="sticky bottom-[calc(var(--app-bottom-clearance)-1rem)] z-10 max-h-[45dvh] space-y-3 overflow-y-auto panel p-3 shadow-pop">
        <p className="type-label">{selected.length ? `Add ${selected.length} photo${selected.length === 1 ? '' : 's'} to…` : 'Select photos, then tap a place'}</p>
        {destinations.map(destination => <div key={destination} className="space-y-2">
          {destinations.length > 1 && <p className="type-meta">{destination}</p>}
          {Object.entries(CATEGORY).map(([type, label]) => { const here = places.filter(place => place.destinationName === destination && place.type === type); return here.length > 0 && <div key={type}>
            <p className="type-micro mb-1 text-muted">{label}</p>
            <div className="flex flex-wrap gap-1.5">{here.map(place => <button key={place.id} type="button" disabled={!selected.length || !!progress} onClick={() => void addTo(place)} className="chip">{place.name}{(saved[place.id] ?? place.photos).length > 0 && <span className="text-muted">· {(saved[place.id] ?? place.photos).length}</span>}</button>)}</div>
          </div> })}
        </div>)}
      </div>
    </>}
    {!pile.length && !progress && Object.keys(saved).length > 0 && <p className="type-body">All sorted. <button type="button" onClick={() => setOpen(false)} className="text-link underline">Done</button></p>}
  </section>
}
