'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PlacePhoto as Photo } from '@/lib/placePhoto'
import { sizedPhoto } from '@/lib/photoSizing'

export default function PlacePhoto({ itemId, name, photos = [], thumbnailClass, fallback, fullWidth = false, onAddress }: { itemId: string; name: string; photos?: string[]; thumbnailClass: string; fallback: ReactNode; fullWidth?: boolean; onAddress?: (address: string) => void }) {
  const element = useRef<HTMLDivElement>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [failed, setFailed] = useState(false)
  const addressFound = useRef(onAddress)
  useEffect(() => { addressFound.current = onAddress })
  const storedPhoto = photos.find(Boolean) ?? null
  useEffect(() => {
    const controller = new AbortController()
    let started = false
    async function load() {
      if (started) return
      started = true
      try {
        const response = await fetch(`/api/place-photo?item=${encodeURIComponent(itemId)}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const found = await response.json() as Photo | { address: string } | null
        if (found && 'url' in found) setPhoto(found)
        if (found?.address) addressFound.current?.(found.address)
      } catch { /* Keep the illustrated placeholder. */ }
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load() }
    })
    if (element.current) observer.observe(element.current)
    return () => { observer.disconnect(); controller.abort() }
  }, [itemId])
  const displayPhoto = storedPhoto ? { url: storedPhoto, mapsUrl: '' } : photo
  if (fullWidth) return <div ref={element} className="shrink-0" style={displayPhoto && !failed ? { width: '100%' } : { minHeight: 1 }}>
    <div className={thumbnailClass} style={displayPhoto && !failed ? { width: '100%' } : { display: 'none' }}>
      {displayPhoto && !failed && <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sizedPhoto(displayPhoto.url, 1080)} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      </>}
    </div>
    {displayPhoto && !failed && displayPhoto.mapsUrl && <a href={displayPhoto.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${name} on Google Maps`} className="mt-1 block text-xs text-muted">View place on <span translate="no">Google Maps</span></a>}
  </div>
  // Card thumbnails: a photo polaroid that keeps its size with or without a photo, so the illustrated fallback always has room.
  // Google's credit sits in the polaroid's bottom strip.
  return <div ref={element} className={`${thumbnailClass ?? ''} photo-polaroid`}>
    <span className="photo-polaroid-image">
      {displayPhoto && !failed ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sizedPhoto(displayPhoto.url, 640)} alt={name} className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
      </> : fallback}
    </span>
    {displayPhoto && !failed && displayPhoto.mapsUrl && <a href={displayPhoto.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${name} on Google Maps`} onClick={event => event.stopPropagation()} className="photo-polaroid-credit relative z-[2]">Photo: <span translate="no">Google Maps</span></a>}
  </div>
}
