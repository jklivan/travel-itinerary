'use client'

import { useEffect, type RefObject } from 'react'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const FIELD = 'textarea, select, [contenteditable="true"], input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"])'

// Pop-ups on phones (the postcard composer, bottom sheets): while you type in one, sets --keyboard on it to how much
// of the screen the keyboard covers, so its styles can end above the keyboard, and keeps the field you're in visible.
// Safari reports the visible area (visualViewport). The iPhone app normally shrinks the page for the keyboard; when
// it doesn't, its keyboard plugin says how tall the keyboard is.
export default function useKeyboardInset(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = ref.current
    const viewport = window.visualViewport
    if (!box || !viewport) return
    let keyboard = 0
    // The page's height with the keyboard closed, per screen width (it only ever grows).
    const fullHeights = new Map<number, number>()
    const fullHeight = () => {
      const height = Math.max(fullHeights.get(window.innerWidth) ?? 0, window.innerHeight)
      fullHeights.set(window.innerWidth, height)
      return height
    }
    fullHeight()
    function measure() {
      if (!box || !viewport) return
      const field = document.activeElement
      const typing = field instanceof HTMLElement && box.contains(field) && field.matches(FIELD)
      const full = fullHeight()
      const belowVisible = Math.max(0, window.innerHeight - (viewport.offsetTop + viewport.height))
      const pageShrank = window.innerHeight < full - 100
      const covered = !typing ? 0 : pageShrank ? belowVisible : Math.max(belowVisible, keyboard)
      box.style.setProperty('--keyboard', `${covered > 40 ? Math.round(covered) : 0}px`)
      if (typing && covered > 40) requestAnimationFrame(() => field.scrollIntoView({ block: 'nearest' }))
    }
    const later = () => { measure(); setTimeout(measure, 150); setTimeout(measure, 400) }
    box.addEventListener('focusin', later)
    box.addEventListener('focusout', later)
    viewport.addEventListener('resize', measure)
    window.addEventListener('resize', measure)
    const listeners: Promise<PluginListenerHandle>[] = []
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Keyboard')) listeners.push(
      Keyboard.addListener('keyboardWillShow', info => { keyboard = info.keyboardHeight; later() }),
      Keyboard.addListener('keyboardWillHide', () => { keyboard = 0; later() }),
    )
    return () => {
      box.removeEventListener('focusin', later); box.removeEventListener('focusout', later)
      viewport.removeEventListener('resize', measure); window.removeEventListener('resize', measure)
      for (const listener of listeners) void listener.then(handle => handle.remove()).catch(() => {})
    }
  }, [ref])
}
