'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Leaving a trip you've been on that isn't posted yet (it's all in there, so it's easy to forget): taps on links to
// other pages (and the header's Back) stop for "Forgot to post?", with Post it (the post box) or Not now (carry on).
// Once per visit to the trip: Not now lets them go, and coming back asks again next time.
export default function ForgotToPost({ tripId, onPost }: { tripId: string; onPost: () => void }) {
  const router = useRouter()
  // Where they were going: a page, or the header's Back (tapped again after Not now).
  const [leavingTo, setLeavingTo] = useState<string | HTMLElement | null>(null)
  const asked = useRef(false)
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (asked.current) return
      const target = event.target instanceof Element ? event.target : null
      const back = target?.closest('[data-app-back]')
      const link = back ? null : target?.closest('a[href]')
      let to: string | HTMLElement
      if (back instanceof HTMLElement) to = back
      else {
        if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return
        const url = new URL(link.href, window.location.href)
        if (url.origin !== window.location.origin || url.pathname.startsWith(`/plan/${tripId}`) || url.pathname.startsWith(`/itinerary/${tripId}`)) return
        to = url.pathname + url.search + url.hash
      }
      event.preventDefault(); event.stopPropagation()
      asked.current = true; setLeavingTo(to)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [tripId])
  if (!leavingTo) return null
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 px-4 [grid-template-columns:minmax(0,1fr)]" role="dialog" aria-modal="true" aria-labelledby="forgot-to-post-heading">
    <div className="panel w-full max-w-sm p-5 text-center shadow-pop">
      <h2 id="forgot-to-post-heading" className="type-title">Forgot to post?</h2>
      <p className="mt-2 text-sm text-muted">This trip looks done but only you can see it. Post it so your friends can see where you went.</p>
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" className="btn btn-primary" onClick={() => { setLeavingTo(null); onPost() }}>Post it</button>
        <button type="button" className="btn btn-outline" onClick={() => { const to = leavingTo; setLeavingTo(null); if (typeof to === 'string') router.push(to); else to.click() }}>Not now</button>
      </div>
    </div>
  </div>
}
