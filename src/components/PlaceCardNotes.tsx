'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePlace } from '@/actions/placeQuickEdit'

// A place's notes on its planner card, typed right there (an empty box says "Add details…"), so it's clear you can
// leave a note. Saves when you leave the box. Sits inside a card that opens on tap, so its own taps stay here.
// Long notes (an emailed booking brings its whole policy) show two lines with More; tapping in opens a taller box
// from the top, scrolling, with the cursor at the end to add to it.
export default function PlaceCardNotes({ itemId, name, notes }: { itemId: string; name: string; notes: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const saved = useRef(notes ?? '')
  const box = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  // More: the whole note, without editing it.
  const [open, setOpen] = useState(false)
  const [long, setLong] = useState(false)
  // Notes changed elsewhere show here too (unless you're typing in this box).
  useEffect(() => { if (document.activeElement !== box.current) { setValue(notes ?? ''); saved.current = notes ?? '' } }, [notes])
  // Two lines folded; all of it when opened with More; while typing, as tall as it needs up to 40% of the screen,
  // scrolling past that.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const style = getComputedStyle(el)
    const folded = parseFloat(style.lineHeight) * 2 + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    el.style.height = 'auto'
    const full = el.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    const tall = Math.max(folded, Math.round(window.innerHeight * 0.4))
    setLong(full > folded + 2)
    el.style.height = `${focused ? Math.min(full, tall) : open ? full : Math.min(full, folded)}px`
    el.style.overflowY = focused && full > tall ? 'auto' : 'hidden'
    // Folded, the cut-off line fades out instead of showing half.
    el.style.maskImage = !focused && !open && full > folded + 2 ? 'linear-gradient(to bottom, #000 55%, transparent)' : ''
  }, [value, focused, open])

  async function save() {
    if (value.trim() === saved.current.trim()) return
    setSaving(true); setError('')
    try {
      const result = await updatePlace(itemId, { kind: 'notes', notes: value })
      if (result.error) { setError(result.error); return }
      saved.current = value
      router.refresh()
    } catch { setError('Could not save your notes. They’re still here; please try again.') }
    finally { setSaving(false) }
  }

  return <div data-no-swipe className="mt-2" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <label className="block"><span className="sr-only">Notes on {name}</span>
      <textarea ref={box} value={value} rows={1} maxLength={8000} placeholder="Add details…" onChange={event => setValue(event.target.value)}
        onFocus={event => { const el = event.currentTarget; setFocused(true); requestAnimationFrame(() => {
          el.setSelectionRange(el.value.length, el.value.length); el.scrollTop = 0
          // Placing the cursor at the end can scroll the page past the top of the note (under the pinned header and
          // trip actions): centre the note so its top shows, now and once the browser's own scrolling settles.
          const show = () => { el.scrollTop = 0; el.scrollIntoView({ block: 'center' }) }
          show(); setTimeout(show, 150)
        }) }}
        onBlur={() => { setFocused(false); void save() }}
        className="field min-h-0 w-full resize-none overflow-hidden !py-1.5 text-sm text-muted focus:text-ink" />
    </label>
    {long && !focused && <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="mt-0.5 text-xs font-semibold text-link">{open ? 'Less' : 'More'}</button>}
    {saving && <p role="status" className="mt-0.5 text-xs text-muted">Saving…</p>}
    {error && <p role="alert" className="mt-0.5 text-xs text-danger">{error}</p>}
  </div>
}
