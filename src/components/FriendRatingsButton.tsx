'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import RatingStars from './RatingStars'

type FriendRating = { friendName: string; rating: number | null; itineraryId: string }

// On a place card when several friends went: "Friends' rating" with their average. Tapping it opens a
// scrollable list of each friend's rating with a link to their trip.
export default function FriendRatingsButton({ friends, placeName, verb }: { friends: FriendRating[]; placeName: string; verb: string }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const rated = friends.filter(friend => friend.rating != null && friend.rating > 0)
  const average = rated.length ? rated.reduce((sum, friend) => sum + friend.rating!, 0) / rated.length : null
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="pointer-events-auto relative z-[3] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left text-link">
      <span className="font-semibold">Friends’ rating</span>
      {average !== null ? <RatingStars value={average} label={`Friends' average ${average.toFixed(1)} out of 5`} /> : <span>{friends.length} friends {verb}</span>}
      <span className="underline underline-offset-2">({friends.length})</span>
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} onClose={() => setOpen(false)}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}
      className="panel m-auto w-[min(92vw,420px)] p-0 text-ink shadow-xl backdrop:bg-ink/50">
      {open && <div className="flex max-h-[75dvh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line-soft p-5 pb-3">
          <div>
            <h2 id={titleId} className="font-[family-name:var(--font-playfair)] text-xl normal-case">Friends’ rating</h2>
            <p className="mt-1 text-sm text-muted">{placeName}{average !== null ? ` · ${average.toFixed(1)} from ${rated.length} ${rated.length === 1 ? 'friend' : 'friends'}` : ''}</p>
          </div>
          <button type="button" autoFocus aria-label="Close" onClick={() => dialog.current?.close()} className="flex size-10 shrink-0 items-center justify-center rounded-full"><X size={20} /></button>
        </header>
        <ul className="overflow-y-auto px-5 py-2">
          {friends.map((friend, index) => <li key={`${friend.itineraryId}-${index}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line-soft py-3 last:border-0">
            <span className="font-semibold text-link">{friend.friendName}</span>
            {friend.rating ? <RatingStars value={friend.rating} label={`${friend.friendName} rated it ${friend.rating} out of 5`} /> : <span className="text-sm text-muted">Went, no rating</span>}
            <Link href={`/itinerary/${friend.itineraryId}`} onClick={() => dialog.current?.close()} className="ml-auto text-sm text-link underline underline-offset-2">See trip →</Link>
          </li>)}
        </ul>
      </div>}
    </dialog>
  </>
}
