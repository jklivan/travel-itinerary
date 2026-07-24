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
      <div className="flex items-center justify-between mb-5">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to feed
        </Link>
        {(prevId || nextId) && (
          <div className="flex items-center gap-1">
            {prevId ? (
              <Link
                href={`/itinerary/${prevId}`}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="Previous itinerary"
              >
                <ChevronLeft size={18} />
              </Link>
            ) : (
              <span className="p-1.5 text-gray-300 cursor-not-allowed">
                <ChevronLeft size={18} />
              </span>
            )}
            {nextId ? (
              <Link
                href={`/itinerary/${nextId}`}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="Next itinerary"
              >
                <ChevronRight size={18} />
              </Link>
            ) : (
              <span className="p-1.5 text-gray-300 cursor-not-allowed">
                <ChevronRight size={18} />
              </span>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
