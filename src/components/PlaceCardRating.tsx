'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePlace } from '@/actions/placeQuickEdit'
import { StarPicker } from './ui/Stars'

// The stars on a planner card: tap to rate (or change it) right there, nothing else opens. Notes are in Edit details.
// Sits inside a card that opens on tap, so its own taps stay here.
export default function PlaceCardRating({ itemId, name, rating }: { itemId: string; name: string; rating: number | null }) {
  const router = useRouter()
  const [value, setValue] = useState(rating ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  // A rating changed elsewhere (Edit details) shows here too.
  useEffect(() => { if (!busy.current) setValue(rating ?? 0) }, [rating])

  async function rate(next: number) {
    if (busy.current) return
    const previous = value
    busy.current = true; setSaving(true); setError(''); setValue(next)
    try {
      const result = await updatePlace(itemId, { kind: 'rating', rating: next })
      if (result.error) { setError(result.error); setValue(previous) } else router.refresh()
    } catch { setError('Could not save. Please try again.'); setValue(previous) }
    finally { busy.current = false; setSaving(false) }
  }

  return <div data-no-swipe className="mt-1" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <div className="-ml-1"><StarPicker value={value} onChange={next => void rate(next)} name={name} size={18} disabled={saving} /></div>
    {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
  </div>
}
