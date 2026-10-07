'use client'

import { Check } from 'lucide-react'
import { sizedPhoto } from '@/lib/photoSizing'

// A sideways-scrolling row of a trip's photos; tap one to make it the cover.
export default function CoverPhotoPicker({ photos, value, onChange, disabled = false }: { photos: string[]; value: string | null; onChange: (url: string) => void; disabled?: boolean }) {
  const selected = value && photos.includes(value) ? value : photos[0] ?? null
  return <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 pt-1" role="radiogroup" aria-label="Cover photo">
    {photos.map((url, index) => <button key={url} type="button" role="radio" aria-checked={url === selected} aria-label={`Photo ${index + 1}${url === selected ? ', cover photo' : ''}`} disabled={disabled}
      onClick={() => onChange(url)} className={`relative size-20 shrink-0 snap-start overflow-hidden rounded-lg disabled:opacity-60 ${url === selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : 'opacity-80 hover:opacity-100'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sizedPhoto(url, 256)} alt="" className="h-full w-full object-cover" />
      {url === selected && <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-ink/85 py-0.5 text-micro font-semibold uppercase tracking-wide text-white"><Check size={12} />Cover</span>}
    </button>)}
  </div>
}
