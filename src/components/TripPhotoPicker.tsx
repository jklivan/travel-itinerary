'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Heart, X } from 'lucide-react'
import { PostcardPhotos, type LibraryPhoto } from '@/lib/tripPhotos'

// In the iPhone app: your photos by date, grouped by day, to tick and add, like scrolling the Photos app. It opens
// on the trip's dates (from the day before it starts to the day after it ends, for travel days) when the trip has
// them, else on this month; the arrows and the month box move to any other month. Falls back to the usual picker
// when the app can't show them.
type View = { kind: 'trip' } | { kind: 'month'; month: string }
const thisMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }
const shiftMonth = (month: string, by: number) => { const [year, number] = month.split('-').map(Number); const next = new Date(year, number - 1 + by, 1); return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export default function TripPhotoPicker({ start, end, name, onPick, onFallback, onClose }: {
  start?: string | null; end?: string | null; name: string
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
  // Only the photos hearted in the Photos app.
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [adding, setAdding] = useState('')
  const [error, setError] = useState('')
  const [view, setView] = useState<View>(start && end ? { kind: 'trip' } : { kind: 'month', month: thisMonth() })
  // A month with more photos than this shows the first ones and says so.
  const LIMIT = 1000
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    let cancelled = false
    const day = (date: string, shift: number) => { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() + shift); return value.toISOString().replace(/\.\d{3}Z$/, 'Z') }
    // (The app reads dates without fractions of a second: 2026-03-31T04:00:00Z.)
    const range = view.kind === 'trip' && start && end ? { start: day(start, -1), end: day(end, 2) } : { start: day(`${view.kind === 'month' ? view.month : thisMonth()}-01`, 0), end: day(`${shiftMonth(view.kind === 'month' ? view.month : thisMonth(), 1)}-01`, 0) }
    void (async () => {
      try {
        const result = await PostcardPhotos.photosBetween({ ...range, limit: LIMIT })
        if (cancelled) return
        setAccess(result.access); setPhotos(result.photos)
      } catch (error) {
        // An app build from before trip photos answers "not implemented"; anything else is a problem reading the
        // library. Either way the usual picker has to be opened from a tap, so offer it rather than opening it here.
        if (!cancelled) { setAccess((error as { code?: string })?.code === 'UNIMPLEMENTED' ? 'unavailable' : 'failed'); setPhotos([]) }
      }
    })()
    return () => { cancelled = true }
  }, [view, start, end])
  // Previews load as you scroll (a few screens at a time), not all at once: a busy month can have a thousand photos,
  // and loading every preview used so much memory that iOS restarted the app's page (back to the feed).
  const PAGE = 60
  const [wanted, setWanted] = useState(PAGE)
  const loadedIds = useRef(new Set<string>())
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const shown = (photos ?? []).filter(photo => !favoritesOnly || photo.favorite)
  // The photos that should have previews by now (changes as you scroll, not as previews arrive).
  const wantedIds = shown.slice(0, wanted).map(photo => photo.id).join(',')
  useEffect(() => {
    if (!wantedIds) return
    const loaded = loadedIds.current
    const pending = wantedIds.split(',').filter(id => !loaded.has(id))
    pending.forEach(id => loaded.add(id))
    let cancelled = false
    void (async () => {
      while (pending.length && !cancelled) {
        const batch = pending.slice(0, 30)
        try {
          const result = await PostcardPhotos.thumbnails({ ids: batch, size: 200 })
          if (!cancelled) setThumbs(current => ({ ...current, ...result.thumbnails }))
        } catch { /* those tiles stay blank */ }
        if (!cancelled) pending.splice(0, batch.length)
      }
    })()
    // Interrupted (e.g. scrolled further): what wasn't fetched yet can be asked for again.
    return () => { cancelled = true; pending.forEach(id => loaded.delete(id)) }
  }, [wantedIds])
  // Near the bottom of what's loaded: load the next screens' worth.
  const more = shown.length > wanted
  useEffect(() => {
    if (!more || !sentinel.current) return
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setWanted(count => count + PAGE) }, { root: scroller.current, rootMargin: '400px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [more, wanted])
  // Another month (or back to the trip): clear what's shown while it loads.
  const go = (next: View) => { setPhotos(null); setThumbs({}); setWanted(PAGE); loadedIds.current.clear(); setView(next) }
  // The month the arrows step from: the trip's first month while showing the trip.
  const month = view.kind === 'month' ? view.month : (start ?? '').slice(0, 7) || thisMonth()

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
  const favorites = (photos ?? []).filter(photo => photo.favorite).length
  for (const photo of (photos ?? []).filter(photo => !favoritesOnly || photo.favorite)) {
    const label = photo.date ? new Date(photo.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Undated'
    days.set(label, [...(days.get(label) ?? []), photo])
  }
  return <dialog ref={dialog} aria-labelledby={titleId} onClose={onClose} className="panel m-auto flex h-[88dvh] w-[min(96vw,560px)] flex-col p-0 text-ink shadow-pop backdrop:bg-ink/50">
    <header className="flex items-start justify-between gap-3 border-b border-line-soft p-4">
      <div><h2 id={titleId} className="type-title normal-case">{view.kind === 'trip' ? 'Photos from this trip' : 'Your photos'}</h2><p className="type-meta mt-1">{view.kind === 'trip' && start && end ? `Taken ${new Date(`${start}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(`${end}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ` : ''}for {name}</p></div>
      <button type="button" aria-label="Close" onClick={() => dialog.current?.close()} className="flex size-10 shrink-0 items-center justify-center rounded-full"><X size={18} /></button>
    </header>
    {/* Browse by month, like scrolling back in the Photos app. */}
    <nav aria-label="Photo dates" className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2">
      <button type="button" aria-label="Previous month" onClick={() => go({ kind: 'month', month: view.kind === 'month' ? shiftMonth(month, -1) : month })} className="btn-icon"><ChevronLeft size={18} /></button>
      <label className="min-w-0 flex-1"><span className="sr-only">Month</span>
        <input type="month" value={view.kind === 'month' ? view.month : ''} max={thisMonth()} placeholder={monthLabel(month)} aria-label={view.kind === 'month' ? monthLabel(view.month) : 'Choose a month'} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) go({ kind: 'month', month: event.target.value }) }} className="field !min-h-9 w-full !py-1.5 text-center" />
      </label>
      <button type="button" aria-label="Next month" disabled={view.kind === 'month' && view.month >= thisMonth()} onClick={() => go({ kind: 'month', month: view.kind === 'month' ? shiftMonth(month, 1) : month })} className="btn-icon"><ChevronRight size={18} /></button>
      {start && end && view.kind === 'month' && <button type="button" onClick={() => go({ kind: 'trip' })} className="chip">Trip dates</button>}
    </nav>
    <div ref={scroller} className="flex-1 overflow-y-auto p-4">
      {favorites > 0 && <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)} className="chip mb-4"><Heart size={12} fill={favoritesOnly ? 'currentColor' : 'none'} />Favorites only ({favorites})</button>}
      {photos === null ? <p className="type-body text-muted">{view.kind === 'trip' ? 'Finding your trip’s photos…' : `Finding your photos from ${monthLabel(view.month)}…`}</p>
        : access === 'failed' ? <p className="type-body">Couldn’t read your trip’s photos. Try again, or <button type="button" className="text-link underline" onClick={() => { dialog.current?.close(); onFallback() }}>choose from your library</button>.</p>
        : access === 'unavailable' ? <p className="type-body">Update the Postcard app to see your trip’s photos here. For now, <button type="button" className="text-link underline" onClick={() => { dialog.current?.close(); onFallback() }}>choose from your library</button>.</p>
        : access === 'denied' ? <p className="type-body">Postcard can’t see your photos. To show your trip’s photos here, allow it in Settings → Postcard → Photos. Or <button type="button" className="text-link underline" onClick={() => { dialog.current?.close(); onFallback() }}>choose from your library</button>.</p>
        : !photos.length ? <p className="type-body">No photos from {view.kind === 'trip' ? 'these dates' : monthLabel(view.month)}{access === 'limited' ? ' among the ones you’ve shared with Postcard' : ''}. Try another month, or <button type="button" className="text-link underline" onClick={() => { dialog.current?.close(); onFallback() }}>choose from your library</button>.</p>
        : [...days.entries()].map(([label, dayPhotos]) => <section key={label} className="mb-5">
          <h3 className="type-label mb-2">{label}</h3>
          <div className="grid grid-cols-4 gap-1">{dayPhotos.map(photo => { const on = selected.includes(photo.id); return <button key={photo.id} type="button" aria-pressed={on} aria-label={`Photo ${photo.date ? new Date(photo.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}`}
            onClick={() => setSelected(current => on ? current.filter(id => id !== photo.id) : [...current, photo.id])} className="relative aspect-square overflow-hidden bg-chip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumbs[photo.id] && <img src={`data:image/jpeg;base64,${thumbs[photo.id]}`} alt="" className={`size-full object-cover ${on ? 'opacity-80' : ''}`} />}
            {on && <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-link text-white ring-2 ring-white"><Check size={14} /></span>}
            {photo.favorite && <Heart size={14} aria-label="Favorite" fill="currentColor" className="absolute bottom-1 left-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />}
          </button> })}</div>
        </section>)}
      {more && <div ref={sentinel} aria-hidden="true" className="h-px" />}
      {photos?.length === LIMIT && <p className="type-meta mb-3">Showing the first {LIMIT} photos from these dates.</p>}
      {access === 'limited' && !!photos?.length && <p className="type-meta">Showing the photos you’ve shared with Postcard. To see all of this trip’s photos, choose “Full Access” in Settings → Postcard → Photos.</p>}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft p-4">
      <button type="button" className="text-sm text-link" onClick={() => { dialog.current?.close(); onFallback() }}>Other photos…</button>
      {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
      <button type="button" disabled={!selected.length || !!adding} onClick={() => void add()} className="btn btn-primary btn-sm">{adding || (selected.length ? `Add ${selected.length} photo${selected.length === 1 ? '' : 's'}` : 'Choose photos')}</button>
    </footer>
  </dialog>
}
