'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { sizedPhoto } from '@/lib/photoSizing'

// A photo full screen (tap a thumbnail): arrows or a swipe for the others, and optionally Remove, so you can see
// whether you picked good ones. Used wherever photos show as small thumbnails while editing.
export default function PhotoViewer({ photos, start, name, onClose, onRemove }: { photos: string[]; start: number; name: string; onClose: () => void; onRemove?: (url: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(Math.min(start, photos.length - 1))
  const touchX = useRef<number | null>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  // Removing the last one, or all of them, closes it.
  const current = photos[Math.min(index, photos.length - 1)]
  useEffect(() => { if (!photos.length) dialog.current?.close() }, [photos.length])
  const go = (step: number) => setIndex(value => (value + step + photos.length) % photos.length)
  if (!current) return null
  return <dialog ref={dialog} aria-label={`${name}, photo ${index + 1} of ${photos.length}`} onClose={onClose}
    onKeyDown={event => { if (event.key === 'ArrowLeft') go(-1); if (event.key === 'ArrowRight') go(1) }}
    className="m-0 h-dvh max-h-none w-full max-w-none bg-ink p-0 text-white backdrop:bg-ink">
    <div className="flex h-full flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="text-sm">{photos.length > 1 ? `${index + 1} of ${photos.length}` : ''}</span>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="btn-icon !border-0 !bg-transparent !text-white"><X size={22} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2"
        onTouchStart={event => { touchX.current = event.touches[0].clientX }}
        onTouchEnd={event => { const from = touchX.current; touchX.current = null; if (from === null || photos.length < 2) return; const moved = event.changedTouches[0].clientX - from; if (Math.abs(moved) > 40) go(moved < 0 ? 1 : -1) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sizedPhoto(current, 1080)} alt={`${name}, photo ${index + 1}`} className="max-h-full max-w-full object-contain" />
        {photos.length > 1 && <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="btn-icon absolute left-2 top-1/2 -translate-y-1/2 !border-0 !bg-ink/60 !text-white"><ChevronLeft size={22} /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo" className="btn-icon absolute right-2 top-1/2 -translate-y-1/2 !border-0 !bg-ink/60 !text-white"><ChevronRight size={22} /></button>
        </>}
      </div>
      {onRemove && <div className="flex justify-center px-3 py-3"><button type="button" onClick={() => { onRemove(current); setIndex(value => Math.max(0, Math.min(value, photos.length - 2))) }} className="btn btn-outline btn-sm !border-white/40 !bg-transparent !text-white"><Trash2 size={16} />Remove this photo</button></div>}
    </div>
  </dialog>
}
