'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { PostcardPhotos, type LibraryPhoto } from '@/lib/tripPhotos'

// In the iPhone app: the photos taken during the trip (from the day before it starts to the day after it ends, for
// travel days), grouped by day, to tick and add. Falls back to the usual picker when the app can't show them.
export default function TripPhotoPicker({ start, end, name, onPick, onFallback, onClose }: {
  start: string; end: string; name: string
  onPick: (files: File[]) => void
  onFallback: () => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null)
  const [access, setAccess] = useState<'all' | 'limited' | 'denied' | 'unavailable' | 'failed'>('all')
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [adding, setAdding] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
    let cancelled = false
    const day = (date: string, shift: number) => { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() + shift); return value.toISOString().replace(/\.\d{3}Z$/, 'Z') }
    // (The app reads dates without fractions of a second: 2026-03-31T04:00:00Z.)
    void (async () => {
      try {
        const result = await PostcardPhotos.photosBetween({ start: day(start, -1), end: day(end, 2) })
        if (cancelled) return
        setAccess(result.access); setPhotos(result.photos)
        // Previews in batches, newest batch shown as it arrives.
        for (let index = 0; index < result.photos.length && !cancelled; index += 60) {
          const batch = await PostcardPhotos.thumbnails({ ids: result.photos.slice(index, index + 60).map(photo => photo.id), size: 240 })
          if (!cancelled) setThumbs(current => ({ ...current, ...batch.thumbnails }))
        }
      } catch (error) {
        // An app build from before trip photos answers "not implemented"; anything else is a problem reading the
        // library. Either way the usual picker has to be opened from a tap, so offer it rather than opening it here.
        if (!cancelled) { setAccess((error as { code?: string })?.code === 'UNIMPLEMENTED' ? 'unavailable' : 'failed'); setPhotos([]) }
      }
    })()
    return () => { cancelled = true }
  }, [start, end])

  async function add() {
    const files: File[] = []
    try {
      for (const [index, id] of selected.entries()) {
        setAdding(`Adding ${index + 1} of ${selected.length}…`)
        const photo = await PostcardPhotos.photo({ id, maxSize: 2048 })
        const bytes = Uint8Array.from(atob(photo.data), char => char.charCodeAt(0))
        files.push(new File([bytes], `trip-photo-${index + 1}.jpg`, { type: photo.mimeType }))
      }
      onPick(files); dialog.current?.close()
    } catch { setError('Some photos couldn’t be loaded (they may still be downloading from iCloud). Try again.'); setAdding('') }
  }

  const days = new Map<string, LibraryPhoto[]>()
  for (const photo of photos ?? []) {
    const label = photo.date ? new Date(photo.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Undated'
    days.set(label, [...(days.get(label) ?? []), photo])
  }
  return <dialog ref={dialog} aria-labelledby={titleId} onClose={onClose} className="panel m-auto flex h-[88dvh] w-[min(96vw,560px)] flex-col p-0 text-ink shadow-pop backdrop:bg-ink/50">
    <header className="flex items-start justify-between gap-3 border-b border-line-soft p-4">
      <div><h2 id={titleId} className="type-title normal-case">Photos from this trip</h2><p className="type-meta mt-1">Taken {new Date(`${start}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(`${end}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · for {name}</p></div>
      <button type="button" aria-label="Close" onClick={() => dialog.current?.close()} className="flex size-10 shrink-0 items-center justify-center rounded-full"><X size={18} /></button>
    </header>
    <div className="flex-1 overflow-y-auto p-4">
      {photos === null ? <p className="type-body text-muted">Finding your trip’s photos…</p>
        : access === 'failed' ? <p className="type-body">Couldn’t read your trip’s photos. Try again, or <button type="button" className="text-link underline" onClick={() => { dialog.current?.close(); onFallback() }}>choose from your library</button>.</p>
        : access === 'unavailable' ? <p className="type-body">Update the Postcard app to see your trip’s photos here. For now, <button type="button" className="text-link underline" onClick={() => { dialog.current?.close(); onFallback() }}>choose from your library</button>.</p>
        : access === 'denied' ? <p className="type-body">Postcard can’t see your photos. To show your trip’s photos here, allow it in Settings → Postcard → Photos. Or <button type="button" className="text-link underline" onClick={() => { dialog.current?.close(); onFallback() }}>choose from your library</button>.</p>
        : !photos.length ? <p className="type-body">No photos from these dates{access === 'limited' ? ' among the ones you’ve shared with Postcard' : ''}. <button type="button" className="text-link underline" onClick={() => { dialog.current?.close(); onFallback() }}>Choose from your library</button></p>
        : [...days.entries()].map(([label, dayPhotos]) => <section key={label} className="mb-5">
          <h3 className="type-label mb-2">{label}</h3>
          <div className="grid grid-cols-4 gap-1">{dayPhotos.map(photo => { const on = selected.includes(photo.id); return <button key={photo.id} type="button" aria-pressed={on} aria-label={`Photo ${photo.date ? new Date(photo.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}`}
            onClick={() => setSelected(current => on ? current.filter(id => id !== photo.id) : [...current, photo.id])} className="relative aspect-square overflow-hidden bg-chip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumbs[photo.id] && <img src={`data:image/jpeg;base64,${thumbs[photo.id]}`} alt="" className={`size-full object-cover ${on ? 'opacity-80' : ''}`} />}
            {on && <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-link text-white ring-2 ring-white"><Check size={14} /></span>}
          </button> })}</div>
        </section>)}
      {access === 'limited' && !!photos?.length && <p className="type-meta">Showing the photos you’ve shared with Postcard. To see all of this trip’s photos, choose “Full Access” in Settings → Postcard → Photos.</p>}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft p-4">
      <button type="button" className="text-sm text-link" onClick={() => { dialog.current?.close(); onFallback() }}>Other photos…</button>
      {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
      <button type="button" disabled={!selected.length || !!adding} onClick={() => void add()} className="btn btn-primary btn-sm">{adding || (selected.length ? `Add ${selected.length} photo${selected.length === 1 ? '' : 's'}` : 'Choose photos')}</button>
    </footer>
  </dialog>
}
