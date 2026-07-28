'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Photo = { id: string; url: string; caption: string | null }

export default function PhotoStrip({ photos, title }: { photos: Photo[]; title: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

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
    <div className="relative h-64 bg-gray-100">
      {/* Scrollable strip */}
      <div ref={ref} className="flex overflow-x-auto snap-x snap-mandatory h-64 scrollbar-hide">
        {photos.map((photo) => (
          <div key={photo.id} className="relative flex-none w-full snap-center h-64">
            <Image src={photo.url} alt={photo.caption ?? title} fill className="object-cover" priority />
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
          onClick={() => scrollTo(current - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/* Right arrow */}
      {current < photos.length - 1 && (
        <button
          onClick={() => scrollTo(current + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          aria-label="Next photo"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Counter */}
      {photos.length > 1 && (
        <div className="absolute bottom-2 right-3 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
          {current + 1} / {photos.length}
        </div>
      )}
    </div>
  )
}
