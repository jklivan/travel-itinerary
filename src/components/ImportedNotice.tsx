'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { CheckCircle2, X } from 'lucide-react'
import { markImportsSeen, unseenImports } from '@/actions/importNotices'

type Arrival = Awaited<ReturnType<typeof unseenImports>>[number]

// When you open the app: trips and places that arrived by email or from an AI assistant while you were away, with a
// link to each. Checked on opening and whenever the app comes back to the front; dismissing or opening marks them seen.
export default function ImportedNotice() {
  const { status } = useSession()
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  useEffect(() => {
    if (status !== 'authenticated') return
    let live = true
    const check = () => { if (document.visibilityState === 'visible') void unseenImports().then(rows => { if (live) setArrivals(rows) }, () => {}) }
    check()
    document.addEventListener('visibilitychange', check)
    return () => { live = false; document.removeEventListener('visibilitychange', check) }
  }, [status])
  if (!arrivals.length) return null
  const seen = (ids: string[]) => { setArrivals(current => current.filter(arrival => !ids.includes(arrival.id))); void markImportsSeen(ids).catch(() => {}) }
  return <div role="status" className="fixed inset-x-0 top-[calc(var(--app-header-height,0px)+0.5rem)] z-[70] px-4">
    <div className="panel-hint mx-auto flex max-w-xl items-start gap-3 p-3 shadow-pop">
      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-link" />
      <div className="min-w-0 flex-1 space-y-1 text-sm text-ink">{arrivals.map(arrival => <p key={arrival.id}>{arrival.newTrip ? 'Your trip ' : 'New places were added to '}<Link href={`/plan/${arrival.tripId}`} onClick={() => seen([arrival.id])} className="font-semibold text-link underline underline-offset-2">{arrival.title}</Link>{arrival.newTrip ? ' arrived in Postcard.' : '.'}</p>)}</div>
      <button type="button" onClick={() => seen(arrivals.map(arrival => arrival.id))} aria-label="Dismiss" className="btn-icon !size-8 shrink-0"><X size={14} /></button>
    </div>
  </div>
}
