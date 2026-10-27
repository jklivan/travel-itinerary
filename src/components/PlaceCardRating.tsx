'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePlace } from '@/actions/placeQuickEdit'
import { StarPicker } from './ui/Stars'

// The stars on a planner card: tap to rate (or change it) right there. Rating opens a box under the stars for
// what you thought of it, since that's when you'd write it. Sits inside a card that opens on tap, so its own
// taps stay here.
export default function PlaceCardRating({ itemId, name, rating, notes }: { itemId: string; name: string; rating: number | null; notes: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(rating ?? 0)
  const [writing, setWriting] = useState(false)
  const [draft, setDraft] = useState(notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  // A rating changed elsewhere (Edit details) shows here too.
  useEffect(() => { if (!busy.current) setValue(rating ?? 0) }, [rating])

  async function write(edit: { rating: number; notes?: string }) {
    if (busy.current) return false
    busy.current = true; setSaving(true); setError('')
    try {
      const result = await updatePlace(itemId, { kind: 'rating', ...edit })
      if (result.error) { setError(result.error); return false }
      router.refresh()
      return true
    } catch { setError('Could not save. Please try again.'); return false }
    finally { busy.current = false; setSaving(false) }
  }

  async function rate(next: number) {
    const previous = value
    setValue(next)
    if (!(await write({ rating: next }))) { setValue(previous); return }
    if (next > 0) { setDraft(notes ?? ''); setWriting(true) }
  }

  async function done() {
    if ((draft.trim() === (notes ?? '').trim()) || await write({ rating: value, notes: draft })) setWriting(false)
  }

  return <div data-no-swipe className="mt-1" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <div className="-ml-1"><StarPicker value={value} onChange={next => void rate(next)} name={name} size={18} disabled={saving} /></div>
    {writing && <div className="mt-2 space-y-2">
      <label className="block">
        <span className="field-label">What did you think?</span>
        <textarea rows={3} value={draft} maxLength={8000} autoFocus onChange={event => setDraft(event.target.value)} placeholder="What you loved, what to order, tips for friends…" className="field mt-1 w-full" />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={() => { setWriting(false); setError('') }} className="btn btn-outline btn-sm">Not now</button>
        <button type="button" disabled={saving} onClick={() => void done()} className="btn btn-primary btn-sm">{saving ? 'Saving…' : 'Done'}</button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
  </div>
}
