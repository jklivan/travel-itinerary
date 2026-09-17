'use client'

import { useEffect } from 'react'
import { trackBackNavigation } from '@/lib/backNavigation'
import { rememberTripReturn } from '@/lib/tripNavigation'

export default function TripNavigation() {
  useEffect(() => {
    const stopTracking = trackBackNavigation(window.history, window.location)
    function remember(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const to = new URL(anchor.href)
      if (to.origin !== window.location.origin) return
      try {
        rememberTripReturn(window.location.pathname + window.location.search + window.location.hash, to.pathname + to.search + to.hash, sessionStorage)
      } catch { /* Back still has an explicit fallback when storage is unavailable. */ }
    }
    document.addEventListener('click', remember, true)
    return () => { stopTracking(); document.removeEventListener('click', remember, true) }
  }, [])
  return null
}
