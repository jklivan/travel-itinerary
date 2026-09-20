'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PlacePhoto as Photo } from '@/lib/placePhoto'

export default function PlacePhoto({ itemId, name, thumbnailClass, fallback, fullWidth = false }: { itemId: string; name: string; thumbnailClass: string; fallback: ReactNode; fullWidth?: boolean }) {
  const element = useRef<HTMLDivElement>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [failed, setFailed] = useState(false)
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
  return <div ref={element} className="shrink-0" style={photo && !failed && fullWidth ? { width: '100%' } : fullWidth ? { minHeight: 1 } : undefined}>
    <div className={thumbnailClass} style={photo && !failed ? { width: '100%' } : fullWidth ? { display: 'none' } : undefined}>
      {photo && !failed ? <>
        {/* Provider photos must not pass through the image optimizer/cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      </> : fallback}
    </div>
    {photo && !failed && <div className="relative z-[2] mt-1 space-y-1 bg-[#fffdf6] p-1 text-xs leading-tight text-[#5e5e5e] [overflow-wrap:anywhere]">
      <a href={photo.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${name} on Google Maps`} className="block font-normal not-italic tracking-normal">View place on <span translate="no">Google Maps</span></a>
    </div>}
  </div>
}
