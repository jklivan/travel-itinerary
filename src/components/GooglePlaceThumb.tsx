'use client'

import { useEffect, useRef, useState } from 'react'
import { sizedPhoto } from '@/lib/photoSizing'

// For a posted place with no saved photo: the same Google photo the planner shows, laid over the card's
// placeholder once it loads (the placeholder stays if Google has nothing). Fetched when scrolled into view.
export default function GooglePlaceThumb({ itemId }: { itemId: string }) {
  const element = useRef<HTMLSpanElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      fetch(`/api/place-photo?item=${encodeURIComponent(itemId)}`, { signal: controller.signal })
        .then(response => response.ok ? response.json() : null)
        .then(photo => { if (photo?.url) setUrl(photo.url) })
        .catch(() => {})
    })
    if (element.current) observer.observe(element.current)
    return () => { observer.disconnect(); controller.abort() }
  }, [itemId])
  return <span ref={element} className="absolute inset-0 z-[1]" style={{ pointerEvents: 'none' }}>
    {url && !failed && <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sizedPhoto(url, 256)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
    </>}
  </span>
}
