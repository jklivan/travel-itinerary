import type { CSSProperties } from 'react'

// How a trip's cover sits in the 4:3 frame every trip card uses: the point to centre on (in % of the photo) and how
// far to zoom in. Stored as "x,y,zoom", e.g. "50,30,1.4". Empty means centred and not zoomed.
export type CoverFocus = { x: number; y: number; zoom: number }
export const CENTRED: CoverFocus = { x: 50, y: 50, zoom: 1 }
export const MAX_ZOOM = 3

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function parseCoverFocus(value: string | null | undefined): CoverFocus {
  const parts = (value ?? '').split(',').map(Number)
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return CENTRED
  return { x: clamp(Math.round(parts[0]), 0, 100), y: clamp(Math.round(parts[1]), 0, 100), zoom: clamp(Math.round(parts[2] * 10) / 10, 1, MAX_ZOOM) }
}

export function formatCoverFocus(focus: CoverFocus): string | null {
  const clean = parseCoverFocus(`${focus.x},${focus.y},${focus.zoom}`)
  return clean.x === 50 && clean.y === 50 && clean.zoom === 1 ? null : `${clean.x},${clean.y},${clean.zoom}`
}

// The style for the cover image (object-fit: cover): centre on the point, and zoom in around it.
export function coverStyle(value: string | null | undefined): CSSProperties | undefined {
  if (!value) return undefined
  const { x, y, zoom } = parseCoverFocus(value)
  return { objectPosition: `${x}% ${y}%`, ...(zoom > 1 ? { transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` } : {}) }
}
