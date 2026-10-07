'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { setTripLike } from '@/actions/likes'

// The heart: a public "I liked this". Saving to a folder is the bookmark next to it.
// pill: the trip page's Like / Liked button. icon: a feed card's heart with its count.
export default function LikeButton({ itineraryId, initialLiked, initialCount, isLoggedIn, variant = 'icon' }: { itineraryId: string; initialLiked: boolean; initialCount: number; isLoggedIn: boolean; variant?: 'pill' | 'icon' }) {
  const router = useRouter()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()
  function toggle(event: React.MouseEvent) {
    event.preventDefault(); event.stopPropagation()
    if (!isLoggedIn) { router.push('/login'); return }
    const next = !liked
    setLiked(next); setCount(current => Math.max(0, current + (next ? 1 : -1)))
    startTransition(async () => {
      try { const result = await setTripLike(itineraryId, next); if (result.error) { setLiked(!next); setCount(current => Math.max(0, current + (next ? -1 : 1))) } else if (typeof result.count === 'number') setCount(result.count) }
      catch { setLiked(!next); setCount(current => Math.max(0, current + (next ? -1 : 1))) }
    })
  }
  if (variant === 'pill') return <button type="button" disabled={pending} onClick={toggle} aria-pressed={liked} aria-label={liked ? 'Unlike trip' : 'Like trip'}
    className="chip chip-like">
    <Heart size={15} className={liked ? 'fill-danger' : ''} />{liked ? 'Liked' : 'Like'}{count > 0 && <span className="text-xs">{count}</span>}
  </button>
  return <button type="button" disabled={pending} onClick={toggle} aria-pressed={liked} aria-label={`${liked ? 'Unlike' : 'Like'} trip · ${count} ${count === 1 ? 'like' : 'likes'}`}
    className={`flex min-h-8 items-center gap-1 text-label transition-colors ${liked ? 'text-danger' : 'hover:text-danger'}`}>
    <Heart size={15} className={liked ? 'fill-danger' : ''} />{count}
  </button>
}
