'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PlacePhoto as Photo } from '@/lib/placePhoto'

export default function PlacePhoto({ itemId, name, thumbnailClass, fallback }: { itemId: string; name: string; thumbnailClass: string; fallback: ReactNode }) {
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
  return <div ref={element} className="shrink-0" style={photo && !failed ? { width: 88 } : undefined}>
    <div className={thumbnailClass} style={photo && !failed ? { width: '100%' } : undefined}>
      {photo && !failed ? <>
        {/* Provider photos must not pass through the image optimizer/cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      </> : fallback}
    </div>
    {photo && !failed && <div className="relative z-[2] mt-1 space-y-1 bg-[#fffdf6] p-1 text-xs leading-tight text-[#5e5e5e] [overflow-wrap:anywhere]">
      <a href={photo.mapsUrl} target="_blank" rel="noopener noreferrer" translate="no" className="block whitespace-nowrap font-normal not-italic tracking-normal">Google Maps</a>
      {photo.authors.map((author, index) => author.uri
        ? <a key={index} href={author.uri} target="_blank" rel="noopener noreferrer" className="block underline">{author.displayName}</a>
        : <span key={index} className="block">{author.displayName}</span>)}
    </div>}
  </div>
}
