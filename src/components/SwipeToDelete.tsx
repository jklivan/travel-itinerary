'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteItinerary } from '@/actions/itinerary'

const REVEAL = 88

// My Trips rows: swipe left to show a Delete button; tapping it asks once more before deleting the trip.
// Swiping right, or tapping the row while it's open, closes it again. On a computer, hovering shows a trash button instead.
export default function SwipeToDelete({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const router = useRouter()
  const start = useRef<{ x: number; y: number; offset: number } | null>(null)
  const moved = useRef(false)
  const latest = useRef(0)
  const [offset, setOffsetState] = useState(0)
  const setOffset = (value: number) => { latest.current = value; setOffsetState(value) }
  const [dragging, setDragging] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const open = offset <= -REVEAL / 2

  async function remove() {
    setBusy(true); setError('')
    try {
      const result = await deleteItinerary(id)
      if (result?.error) { setError(result.error); setBusy(false) } else router.refresh()
    } catch { setError('Could not delete this trip. Please try again.'); setBusy(false) }
  }

  if (confirming) return <div className="panel p-4 text-sm">
    <p className="text-ink">Delete <span className="font-semibold">{title}</span> and all its places, notes and photos? This can’t be undone.</p>
    {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
    <div className="mt-3 flex gap-2">
      <button type="button" disabled={busy} onClick={() => void remove()} className="btn bg-danger text-white hover:opacity-90">{busy ? 'Deleting…' : 'Delete trip'}</button>
      <button type="button" disabled={busy} onClick={() => { setConfirming(false); setOffset(0) }} className="btn btn-outline">Keep it</button>
    </div>
  </div>

  return <div className="group relative overflow-hidden rounded-2xl">
    <button type="button" aria-label={`Delete ${title}`} tabIndex={open ? 0 : -1} onClick={() => setConfirming(true)}
      className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 bg-danger text-sm font-semibold text-white" style={{ width: REVEAL }}>
      <Trash2 size={18} />Delete
    </button>
    <div style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform .2s', touchAction: 'pan-y' }}
      onPointerDown={event => { start.current = { x: event.clientX, y: event.clientY, offset: latest.current }; moved.current = false }}
      onPointerMove={event => {
        const s = start.current; if (!s) return
        const dx = event.clientX - s.x, dy = event.clientY - s.y
        if (!moved.current && Math.abs(dx) < 8) return
        if (!moved.current && Math.abs(dy) > Math.abs(dx)) { start.current = null; return }
        moved.current = true; setDragging(true)
        setOffset(Math.max(-REVEAL - 20, Math.min(0, s.offset + dx)))
      }}
      onPointerUp={() => { if (start.current && moved.current) setOffset(latest.current < -REVEAL / 2 ? -REVEAL : 0); start.current = null; setDragging(false) }}
      onPointerCancel={() => { start.current = null; setDragging(false); setOffset(open ? -REVEAL : 0) }}
      onClickCapture={event => { if (moved.current || open) { event.preventDefault(); event.stopPropagation(); moved.current = false; if (open) setOffset(0) } }}>
      {children}
    </div>
    {/* Computers: no swipe, so a trash button shows when you hover over the trip. */}
    {!open && <button type="button" aria-label={`Delete ${title}`} onClick={() => setConfirming(true)}
      className="absolute right-3 top-3 hidden h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-muted opacity-0 shadow-sm transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:flex">
      <Trash2 size={16} />
    </button>}
  </div>
}
