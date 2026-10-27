'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// iPhone app: a way to put the keyboard away. The ‹ › Done bar shows above the keyboard, and a tap on an empty part
// of the page (not a field, button or link, and not a scroll) closes it, as in other apps.
export default function KeyboardDismiss() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Keyboard')) return
    void Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {})
    let start: { x: number; y: number } | null = null
    const down = (event: TouchEvent) => { const touch = event.touches[0]; start = touch ? { x: touch.clientX, y: touch.clientY } : null }
    const up = (event: TouchEvent) => {
      const touch = event.changedTouches[0], from = start
      start = null
      if (!from || !touch || Math.hypot(touch.clientX - from.x, touch.clientY - from.y) > 10) return
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !active.matches('input, textarea, select, [contenteditable="true"]')) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, select, label, button, a, [role="button"], [contenteditable="true"]')) return
      active.blur()
    }
    document.addEventListener('touchstart', down, { passive: true })
    document.addEventListener('touchend', up, { passive: true })
    return () => { document.removeEventListener('touchstart', down); document.removeEventListener('touchend', up) }
  }, [])
  return null
}
