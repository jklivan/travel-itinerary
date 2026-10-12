'use client'

import { useEffect, useRef, useState } from 'react'
import { sizedPhoto } from '@/lib/photoSizing'

// A trip card with no photos of its own: borrow a Google photo of one of the trip's places (tried in order, once
// the card scrolls into view), else a stock photo of the destination (saved to the trip). The colour shows only
// while loading, or if neither exists.
export default function CardPlacePhoto({ tripId, itemIds }: { tripId: string; itemIds: string[] }) {
  const element = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const key = itemIds.join(',')
  useEffect(() => {
    const ids = key ? key.split(',') : []
    const controller = new AbortController()
    async function load() {
      for (const id of ids) {
        try {
          const response = await fetch(`/api/place-photo?item=${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
          const found = response.ok ? await response.json() as { url?: string } | null : null
          if (found?.url) { setUrl(found.url); return }
        } catch { return }
      }
      try {
        const response = await fetch(`/api/trip-stock-photo?trip=${encodeURIComponent(tripId)}`, { cache: 'no-store', signal: controller.signal })
        const found = response.ok ? await response.json() as { url?: string | null } : null
        if (found?.url) setUrl(found.url)
      } catch { /* keep the colour */ }
    }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load() } })
    if (element.current) observer.observe(element.current)
    return () => { observer.disconnect(); controller.abort() }
  }, [key, tripId])
  return <div ref={element} className="absolute inset-0">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url && !failed && <img src={sizedPhoto(url, 640)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />}
  </div>
}
