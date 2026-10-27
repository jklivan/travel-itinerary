'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { sizedPhoto } from '@/lib/photoSizing'

// A sideways-scrolling row of a trip's photos; tap one to make it the cover.
// `onRemove`: each photo also gets a small ✕ to take it off the trip (asks first). Returns an error to show, if any.
export default function CoverPhotoPicker({ photos, value, onChange, onRemove, disabled = false }: { photos: string[]; value: string | null; onChange: (url: string) => void; onRemove?: (url: string) => Promise<string | void>; disabled?: boolean }) {
  const selected = value && photos.includes(value) ? value : photos[0] ?? null
  const [removing, setRemoving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function remove(url: string) {
    if (!onRemove || busy) return
    setBusy(true); setError('')
    try { const problem = await onRemove(url); if (problem) setError(problem); else setRemoving(null) }
    catch { setError('Could not remove that photo. Please try again.') }
    finally { setBusy(false) }
  }
  return <div>
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 pt-1" role="radiogroup" aria-label="Cover photo">
      {photos.map((url, index) => <div key={url} className="relative shrink-0 snap-start">
        <button type="button" role="radio" aria-checked={url === selected} aria-label={`Photo ${index + 1}${url === selected ? ', cover photo' : ''}`} disabled={disabled || busy}
          onClick={() => onChange(url)} className={`relative block size-20 overflow-hidden rounded-lg disabled:opacity-60 ${url === selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : 'opacity-80 hover:opacity-100'} ${removing === url ? 'ring-2 ring-danger ring-offset-2 ring-offset-card' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sizedPhoto(url, 256)} alt="" className="h-full w-full object-cover" />
          {url === selected && <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-ink/85 py-0.5 text-micro font-semibold uppercase tracking-wide text-white"><Check size={12} />Cover</span>}
        </button>
        {onRemove && <button type="button" disabled={disabled || busy} onClick={() => { setRemoving(url); setError('') }} aria-label={`Remove photo ${index + 1} from the trip`} className="absolute -top-1 -right-1 rounded-full bg-ink p-1 text-white disabled:opacity-50"><X size={12} /></button>}
      </div>)}
    </div>
    {removing && <div role="alert" className="panel-inset mt-1 space-y-2 p-3 text-sm text-ink">
      <p>Remove this photo from the trip? It comes off any place it’s on too.</p>
      {error && <p className="text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void remove(removing)} className="btn btn-danger btn-sm">{busy ? 'Removing…' : 'Remove photo'}</button>
        <button type="button" disabled={busy} onClick={() => { setRemoving(null); setError('') }} className="btn btn-outline btn-sm">Keep it</button>
      </div>
    </div>}
  </div>
}
