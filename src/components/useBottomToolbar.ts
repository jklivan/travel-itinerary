'use client'

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { keyboardCoversToolbar } from '@/lib/bottomToolbar'

export default function useBottomToolbar() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = ref.current
    // Safari and other iOS browsers share the same viewport behavior as WKWebView.
    // iPad Safari can identify itself as a Mac when requesting desktop sites.
    const isIOS = Capacitor.getPlatform() === 'ios'
      || /iPhone|iPad|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (!bar || !isIOS) return
    const viewport = window.visualViewport
    let frame = 0
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    function update() {
      if (!bar) return
      const active = document.activeElement
      const editing = active instanceof HTMLElement && (active.isContentEditable
        || active.matches('textarea, select, input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"])'))
      // Keep CSS fixed positioning: scroll-driven document coordinates lag behind
      // iOS's asynchronous scrolling. Only keyboard visibility needs JavaScript.
      bar.style.visibility = viewport && keyboardCoversToolbar(editing, window.innerHeight, viewport.height, viewport.scale) ? 'hidden' : 'visible'
    }
    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    function settle() {
      schedule()
      clearTimeout(settleTimer)
      // Keyboard dismissal finishes after focusout on iOS.
      settleTimer = setTimeout(schedule, 400)
    }
    window.addEventListener('resize', settle)
    window.addEventListener('pageshow', settle)
    viewport?.addEventListener('resize', settle)
    document.addEventListener('focusin', settle)
    document.addEventListener('focusout', settle)
    update()
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settleTimer)
      window.removeEventListener('resize', settle)
      window.removeEventListener('pageshow', settle)
      viewport?.removeEventListener('resize', settle)
      document.removeEventListener('focusin', settle)
      document.removeEventListener('focusout', settle)
      bar.style.removeProperty('visibility')
    }
  }, [])
  return ref
}
