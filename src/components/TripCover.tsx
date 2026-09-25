'use client'

import { useEffect, useState } from 'react'

// Cover for a trip card: a saved photo, else the first place's Google photo (as the planner shows it),
// else a destination stock photo, else the Postcard placeholder. Plain <img> because saved and provider
// photos can come from hosts the image optimizer doesn't allow.
export default function TripCover({ saved, itemId, stock }: { saved: string | null; itemId: string | null; stock: string | null }) {
  const [failed, setFailed] = useState<string[]>([])
  const savedWorks = !!saved && !failed.includes(saved)
  const [google, setGoogle] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  // Look up the place's Google photo when there's no saved photo, or the saved one fails to load.
  const lookup = !savedWorks && !!itemId
  useEffect(() => {
    if (!lookup) return
    const controller = new AbortController()
    fetch(`/api/place-photo?item=${encodeURIComponent(itemId!)}${saved ? '&fallback=1' : ''}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(photo => { if (photo?.url) setGoogle(photo.url) })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setChecked(true) })
    return () => controller.abort()
  }, [lookup, itemId, saved])
  const url = [saved, google, checked || !itemId ? stock : null].find(candidate => candidate && !failed.includes(candidate)) ?? null
  if (!url) return <span className="grid h-full place-items-center text-[9px] uppercase tracking-wider text-[#59694f]">Postcard</span>
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(current => [...current, url])} />
    {url === google && <span className="absolute bottom-0.5 right-1 text-[7px] text-white drop-shadow">Google</span>}
  </>
}
