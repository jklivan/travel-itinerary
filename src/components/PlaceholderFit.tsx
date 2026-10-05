'use client'

import { useEffect } from 'react'

const MIN_PX = 11

// Every text and search box: shrinks its placeholder (not what you type) just enough to show in full,
// e.g. "Search destinations, trip types, or keywords" on a phone. Sets --placeholder-size, used in globals.css.
export default function PlaceholderFit() {
  useEffect(() => {
    // A hidden copy of the text in the input's own font gives the true width (letter spacing included).
    const probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0'
    document.body.appendChild(probe)
    const fit = (input: HTMLInputElement) => {
      if (!input.placeholder) return
      input.style.removeProperty('--placeholder-size')
      const style = getComputedStyle(input)
      const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2
      if (room <= 0) return
      const size = parseFloat(style.fontSize)
      Object.assign(probe.style, { fontFamily: style.fontFamily, fontSize: `${size}px`, fontWeight: style.fontWeight, letterSpacing: style.letterSpacing, fontStretch: style.fontStretch })
      probe.textContent = input.placeholder
      const width = probe.getBoundingClientRect().width
      // A little spare room, since search boxes keep some space for their clear button.
      if (width > room * 0.96) input.style.setProperty('--placeholder-size', `${Math.max(MIN_PX, Math.floor(size * room * 0.94 / width * 10) / 10)}px`)
    }
    const selector = 'input[placeholder]:not([type=number]):not([type=date])'
    const fitAll = () => document.querySelectorAll<HTMLInputElement>(selector).forEach(fit)
    const resize = new ResizeObserver(entries => entries.forEach(entry => fit(entry.target as HTMLInputElement)))
    const watch = () => document.querySelectorAll<HTMLInputElement>(selector).forEach(input => resize.observe(input))
    // Inputs come and go as you navigate and open forms; placeholders can change too.
    let frame = 0
    const mutations = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { watch(); fitAll() }) })
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder'] })
    watch(); fitAll()
    void document.fonts?.ready.then(fitAll)
    return () => { cancelAnimationFrame(frame); mutations.disconnect(); resize.disconnect(); probe.remove() }
  }, [])
  return null
}
