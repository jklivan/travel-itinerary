'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Leaving a trip you've been on that isn't posted yet (it's all in there, so it's easy to forget): taps on links to
// other pages stop once a day for "Forgot to post?", with Post it (the post box) or Not now (carry on).
export default function ForgotToPost({ tripId, onPost }: { tripId: string; onPost: () => void }) {
  const router = useRouter()
  const [leavingTo, setLeavingTo] = useState<string | null>(null)
  useEffect(() => {
    const key = `forgotToPost:${tripId}`
    const today = new Date().toISOString().slice(0, 10)
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname.startsWith(`/plan/${tripId}`) || url.pathname.startsWith(`/itinerary/${tripId}`)) return
      try { if (localStorage.getItem(key) === today) return; localStorage.setItem(key, today) } catch { return }
      event.preventDefault(); event.stopPropagation()
      setLeavingTo(url.pathname + url.search + url.hash)
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
        <button type="button" className="btn btn-outline" onClick={() => { const to = leavingTo; setLeavingTo(null); router.push(to) }}>Not now</button>
      </div>
    </div>
  </div>
}
