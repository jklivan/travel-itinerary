'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function SwipeNav({
  prevId,
  nextId,
  children,
}: {
  prevId: string | null
  nextId: string | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const touchStartX = useRef<number | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    touchStartX.current = null
    if (Math.abs(delta) < 60) return
    if (delta > 0 && nextId) router.push(`/itinerary/${nextId}`)
    else if (delta < 0 && prevId) router.push(`/itinerary/${prevId}`)
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Back link */}
      <Link href="/" className="text-sm text-blue-600 hover:underline mb-5 inline-block">
        ← Back to feed
      </Link>

      {/* Fixed side arrows */}
      {prevId && (
        <Link
          href={`/itinerary/${prevId}`}
          aria-label="Previous itinerary"
          className="fixed left-2 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-md text-gray-600 hover:text-gray-900 hover:bg-white transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
      )}
      {nextId && (
        <Link
          href={`/itinerary/${nextId}`}
          aria-label="Next itinerary"
          className="fixed right-2 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-md text-gray-600 hover:text-gray-900 hover:bg-white transition-colors"
        >
          <ChevronRight size={20} />
        </Link>
      )}

      {children}
    </div>
  )
}
