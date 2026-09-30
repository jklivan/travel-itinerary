'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PlacePhoto as Photo } from '@/lib/placePhoto'
import { sizedPhoto } from '@/lib/photoSizing'

export default function PlacePhoto({ itemId, name, photos = [], thumbnailClass, fallback, fullWidth = false }: { itemId: string; name: string; photos?: string[]; thumbnailClass: string; fallback: ReactNode; fullWidth?: boolean }) {
  const element = useRef<HTMLDivElement>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [failed, setFailed] = useState(false)
  const storedPhoto = photos.find(Boolean) ?? null
  useEffect(() => {
    const controller = new AbortController()
    let started = false
    async function load() {
      if (started) return
      started = true
      try {
        const response = await fetch(`/api/place-photo?item=${encodeURIComponent(itemId)}`, { cache: 'no-store', signal: controller.signal })
        if (response.ok) setPhoto(await response.json())
      } catch { /* Keep the illustrated placeholder. */ }
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load() }
    })
    if (element.current) observer.observe(element.current)
    return () => { observer.disconnect(); controller.abort() }
  }, [itemId])
  const displayPhoto = storedPhoto ? { url: storedPhoto, mapsUrl: '' } : photo
  // Card thumbnails keep their width with or without a photo, so the illustrated fallback always has room.
  return <div ref={element} className="shrink-0" style={displayPhoto && !failed && fullWidth ? { width: '100%' } : fullWidth ? { minHeight: 1 } : { width: '36%', maxWidth: 132 }}>
    <div className={thumbnailClass} style={displayPhoto && !failed || !fullWidth ? { width: '100%' } : { display: 'none' }}>
      {displayPhoto && !failed ? <>
        {/* Card thumbnails fill their box (it has a minimum height, not a fixed one), cropped to fit. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sizedPhoto(displayPhoto.url, fullWidth ? 1080 : 640)} alt={name} className={fullWidth ? 'h-full w-full object-cover' : 'absolute inset-0 h-full w-full object-cover'} onError={() => setFailed(true)} />
      </> : fallback}
    </div>
    {displayPhoto && !failed && displayPhoto.mapsUrl && <div className="relative z-[2] mt-1 space-y-1 bg-card p-1 text-xs leading-tight text-[#5e5e5e] [overflow-wrap:anywhere]">
      <a href={displayPhoto.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${name} on Google Maps`} className="block font-normal not-italic tracking-normal">View place on <span translate="no">Google Maps</span></a>
    </div>}
  </div>
}
