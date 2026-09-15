'use client'

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { bottomToolbarTop, keyboardCoversToolbar } from '@/lib/bottomToolbar'

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
      bar.style.position = 'absolute'
      bar.style.bottom = 'auto'
      const scrollY = Math.min(window.scrollY, Math.max(0, document.documentElement.scrollHeight - window.innerHeight))
      bar.style.top = `${bottomToolbarTop(scrollY, window.innerHeight, bar.offsetHeight)}px`
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
    const observer = new ResizeObserver(schedule)
    observer.observe(bar)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', settle)
    window.addEventListener('pageshow', settle)
    viewport?.addEventListener('resize', settle)
    viewport?.addEventListener('scroll', schedule)
    document.addEventListener('focusin', settle)
    document.addEventListener('focusout', settle)
    update()
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settleTimer)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', settle)
      window.removeEventListener('pageshow', settle)
      viewport?.removeEventListener('resize', settle)
      viewport?.removeEventListener('scroll', schedule)
      document.removeEventListener('focusin', settle)
      document.removeEventListener('focusout', settle)
      for (const name of ['position', 'bottom', 'top', 'visibility']) bar.style.removeProperty(name)
    }
  }, [])
  return ref
}
