'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PlacePhoto as Photo } from '@/lib/placePhoto'

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
  return <div ref={element} className="shrink-0" style={displayPhoto && !failed && fullWidth ? { width: '100%' } : fullWidth ? { minHeight: 1 } : undefined}>
    <div className={thumbnailClass} style={displayPhoto && !failed ? { width: '100%' } : fullWidth ? { display: 'none' } : undefined}>
      {displayPhoto && !failed ? <>
        {/* Provider photos must not pass through the image optimizer/cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={displayPhoto.url} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      </> : fallback}
    </div>
    {displayPhoto && !failed && displayPhoto.mapsUrl && <div className="relative z-[2] mt-1 space-y-1 bg-[#fffdf6] p-1 text-xs leading-tight text-[#5e5e5e] [overflow-wrap:anywhere]">
      <a href={displayPhoto.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${name} on Google Maps`} className="block font-normal not-italic tracking-normal">View place on <span translate="no">Google Maps</span></a>
    </div>}
  </div>
}
