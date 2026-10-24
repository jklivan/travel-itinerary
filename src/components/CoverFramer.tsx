'use client'

import { useRef, useState } from 'react'
import { sizedPhoto } from '@/lib/photoSizing'
import { CENTRED, MAX_ZOOM, coverStyle, formatCoverFocus, parseCoverFocus, type CoverFocus } from '@/lib/coverFocus'

// Framing a trip's cover: the photo in the same 4:3 frame the feed uses. Drag it to choose what shows, and zoom in.
// onChange gets the new framing ("x,y,zoom", or null when centred) as it changes.
export default function CoverFramer({ url, value, onChange, disabled = false }: { url: string; value: string | null | undefined; onChange: (focus: string | null) => void; disabled?: boolean }) {
  const focus = parseCoverFocus(value)
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; from: CoverFocus } | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const set = (next: CoverFocus) => onChange(formatCoverFocus(next))

  // How far the photo can move each way, in pixels: the part of it the frame crops off (more when zoomed in).
  function overflow() {
    const box = frame.current?.getBoundingClientRect()
    if (!box) return { x: 1, y: 1 }
    const scale = natural ? Math.max(box.width / natural.w, box.height / natural.h) : 1
    const w = natural ? natural.w * scale : box.width, h = natural ? natural.h * scale : box.height
    return { x: Math.max(w * focus.zoom - box.width, 1), y: Math.max(h * focus.zoom - box.height, 1) }
  }

  return <div className="space-y-2">
    <div ref={frame} className={`relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg bg-mist touch-none select-none ${disabled ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={event => { if (disabled) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, from: focus } }}
      onPointerMove={event => {
        const start = drag.current
        if (!start) return
        const room = overflow()
        // The photo follows the finger: dragging right shows more of its left side.
        set({ ...start.from, x: Math.min(100, Math.max(0, start.from.x - (event.clientX - start.x) / room.x * 100)), y: Math.min(100, Math.max(0, start.from.y - (event.clientY - start.y) / room.y * 100)) })
      }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sizedPhoto(url, 1080)} alt="Cover photo, as it shows in the feed" draggable={false} onLoad={event => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={coverStyle(formatCoverFocus(focus))} />
    </div>
    <div className="flex max-w-sm items-center gap-3">
      <label className="flex flex-1 items-center gap-2 text-sm text-ink">Zoom
        <input type="range" min={1} max={MAX_ZOOM} step={0.1} value={focus.zoom} disabled={disabled} onChange={event => set({ ...focus, zoom: Number(event.target.value) })} className="min-w-0 flex-1 accent-link" />
      </label>
      <button type="button" disabled={disabled || !formatCoverFocus(focus)} onClick={() => set(CENTRED)} className="btn btn-outline btn-sm">Reset</button>
    </div>
    <p className="text-xs text-muted">Drag the photo to choose what shows. This is how it looks in the feed.</p>
  </div>
}
