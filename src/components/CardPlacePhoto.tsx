'use client'

import { useEffect, useRef, useState } from 'react'
import { sizedPhoto } from '@/lib/photoSizing'

// A trip card with no photos of its own: borrow a Google photo of one of the trip's places (tried in order,
// once the card scrolls into view). Until one loads, or if none has a photo, the card keeps its colour.
export default function CardPlacePhoto({ itemIds }: { itemIds: string[] }) {
  const element = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const key = itemIds.join(',')
  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (!ids.length) return
    const controller = new AbortController()
    async function load() {
      for (const id of ids) {
        try {
          const response = await fetch(`/api/place-photo?item=${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
          const found = response.ok ? await response.json() as { url?: string } | null : null
          if (found?.url) { setUrl(found.url); return }
        } catch { return }
      }
    }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load() } })
    if (element.current) observer.observe(element.current)
    return () => { observer.disconnect(); controller.abort() }
  }, [key])
  return <div ref={element} className="absolute inset-0">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url && !failed && <img src={sizedPhoto(url, 640)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />}
  </div>
}
