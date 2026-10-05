'use client'

import { useEffect } from 'react'

// Keeps --app-header-height (on <html>) equal to the sticky header's height, so things that stick while you scroll
// (the planner's action row) stop just below the header instead of sliding behind it. The height changes with the
// iPhone status bar and screen size.
export default function HeaderHeight() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.app-header')
    if (!header) return
    const set = () => document.documentElement.style.setProperty('--app-header-height', `${header.offsetHeight}px`)
    set()
    const observer = new ResizeObserver(set)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  return null
}
