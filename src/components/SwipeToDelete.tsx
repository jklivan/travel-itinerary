'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteItinerary } from '@/actions/itinerary'

const REVEAL = 88

// Swipe a card left to show a Delete button; tapping it asks once more before deleting.
// Swiping right, or tapping the card while it's open, closes it again. On a computer, hovering shows a trash button instead.
// Drag handles (data-no-swipe) and form fields don't start a swipe.
export default function SwipeToDelete({ title, message, confirmLabel, keepLabel, onDelete, disabled = false, hoverButton = true, className = 'rounded-2xl', children }: {
  title: string
  message: ReactNode
  confirmLabel: string
  keepLabel: string
  // Returns an error message to show, or nothing when it worked.
  onDelete: () => Promise<string | void> | string | void
  disabled?: boolean
  hoverButton?: boolean
  className?: string
  children: ReactNode
}) {
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
      const result = await onDelete()
      if (result) { setError(result); setBusy(false) }
    } catch { setError('Could not delete. Please try again.'); setBusy(false) }
  }

  if (confirming) return <div className={`panel p-4 text-sm ${className}`}>
    <p className="text-ink">{message}</p>
    {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void remove()} className="btn bg-danger text-white hover:opacity-90">{busy ? 'Deleting…' : confirmLabel}</button>
      <button type="button" disabled={busy} onClick={() => { setConfirming(false); setOffset(0) }} className="btn btn-outline">{keepLabel}</button>
    </div>
  </div>

  if (disabled) return <>{children}</>

  return <div className={`group relative overflow-hidden ${className}`}>
    <button type="button" aria-label={`Delete ${title}`} tabIndex={open ? 0 : -1} onClick={() => setConfirming(true)}
      className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 bg-danger text-sm font-semibold text-white" style={{ width: REVEAL }}>
      <Trash2 size={18} />Delete
    </button>
    <div style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform .2s', touchAction: 'pan-y' }}
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('[data-no-swipe], input, textarea, select')) { start.current = null; return }
        start.current = { x: event.clientX, y: event.clientY, offset: latest.current }; moved.current = false
      }}
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
    {/* Computers: no swipe, so a trash button shows when you hover over the card. */}
    {hoverButton && !open && <button type="button" aria-label={`Delete ${title}`} onClick={() => setConfirming(true)}
      className="absolute right-3 top-3 z-[3] hidden h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-muted opacity-0 shadow-sm transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:flex">
      <Trash2 size={16} />
    </button>}
  </div>
}

// My Trips rows. The page is a server component, so the delete is wired up here.
export function SwipeToDeleteTrip({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const router = useRouter()
  return <SwipeToDelete title={title} confirmLabel="Delete trip" keepLabel="Keep it"
    message={<>Delete <span className="font-semibold">{title}</span> and all its places, notes and photos? This can’t be undone.</>}
    onDelete={async () => { const result = await deleteItinerary(id); if (result?.error) return result.error; router.refresh() }}>
    {children}
  </SwipeToDelete>
}
