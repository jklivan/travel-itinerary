'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePlace } from '@/actions/placeQuickEdit'

// A place's notes on its planner card, typed right there (an empty box says "Add details…"), so it's clear you can
// leave a note. Saves when you leave the box. Sits inside a card that opens on tap, so its own taps stay here.
export default function PlaceCardNotes({ itemId, name, notes }: { itemId: string; name: string; notes: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const saved = useRef(notes ?? '')
  const box = useRef<HTMLTextAreaElement>(null)
  // Notes changed elsewhere show here too (unless you're typing in this box).
  useEffect(() => { if (document.activeElement !== box.current) { setValue(notes ?? ''); saved.current = notes ?? '' } }, [notes])
  // Grows with what's written.
  useEffect(() => { const el = box.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }, [value])

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
      <textarea ref={box} value={value} rows={1} maxLength={8000} placeholder="Add details…" onChange={event => setValue(event.target.value)} onBlur={() => void save()}
        className="field min-h-0 w-full resize-none overflow-hidden !py-1.5 text-sm text-muted focus:text-ink" />
    </label>
    {saving && <p role="status" className="mt-0.5 text-xs text-muted">Saving…</p>}
    {error && <p role="alert" className="mt-0.5 text-xs text-danger">{error}</p>}
  </div>
}
