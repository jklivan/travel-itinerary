'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Photo = { id: string; url: string; caption: string | null }

export default function PhotoStrip({ photos, title, contain = false, fillContainer = false, counterPosition = 'right' }: { photos: Photo[]; title: string; contain?: boolean; fillContainer?: boolean; counterPosition?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [failed, setFailed] = useState<Set<string>>(new Set())

  const scrollTo = useCallback((index: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const index = Math.round(el.scrollLeft / el.clientWidth)
      setCurrent(index)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div role="region" aria-label={`${title} photos`} aria-roledescription="carousel" className={`relative bg-gray-100 ${fillContainer ? 'h-full' : 'h-64'}`}>
      {/* Scrollable strip */}
      <div ref={ref} tabIndex={photos.length > 1 ? 0 : undefined} aria-label="Scroll through photos" onKeyDown={event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          scrollTo(Math.max(0, Math.min(photos.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1))))
        }
      }} className={`flex overflow-x-auto snap-x snap-mandatory scrollbar-hide ${fillContainer ? 'h-full' : 'h-64'}`} style={{ overscrollBehaviorX: 'contain' }}>
        {photos.map((photo, index) => (
          <div key={photo.id} className={`relative flex-none w-full snap-center ${fillContainer ? 'h-full' : 'h-64'}`}>
            {failed.has(photo.id) ? <p className="flex h-full items-center justify-center p-4 text-sm text-gray-500">This photo could not be loaded.</p> :
              <Image src={photo.url} alt={photo.caption ?? title} fill sizes="(max-width: 768px) 100vw, 900px" className={contain ? 'object-contain' : 'object-cover'} loading={index === 0 ? 'eager' : 'lazy'} onError={() => setFailed(previous => new Set([...previous, photo.id]))} />}
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                <p className="text-white text-xs font-medium drop-shadow">{photo.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Left arrow */}
      {current > 0 && (
        <button
          type="button"
          onClick={() => scrollTo(current - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full min-h-11 min-w-11 flex items-center justify-center p-1.5 transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/* Right arrow */}
      {current < photos.length - 1 && (
        <button
          type="button"
          onClick={() => scrollTo(current + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full min-h-11 min-w-11 flex items-center justify-center p-1.5 transition-colors"
          aria-label="Next photo"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Counter */}
      {photos.length > 1 && (
        <div aria-live="polite" className={`absolute bottom-2 ${counterPosition === 'left' ? 'left-3' : 'right-3'} bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none`}>
          {current + 1} / {photos.length}
        </div>
      )}
    </div>
  )
}
