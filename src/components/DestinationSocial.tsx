'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Bookmark, Users, X } from 'lucide-react'

export type DestinationFriend = { name: string; itineraryId: string }

// Under a destination's name on a trip: which friends have been there and how many travelers saved a trip
// there (about the destination, not one place). Tapping it lists the friends with their trips; people who
// saved a trip are named only if you follow them.
export default function DestinationSocial({ destination, friends, savers }: { destination: string; friends: DestinationFriend[]; savers: { names: string[]; total: number } }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])
  if (!friends.length && !savers.total) return null
  const first = friends.map(friend => friend.name.split(' ')[0])
  const others = savers.total - savers.names.length
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-left text-xs text-brown">
      {friends.length > 0 && <span className="inline-flex items-center gap-1"><Users size={12} aria-hidden="true" /><span><span className="font-medium text-ink-soft">{first.slice(0, 2).join(', ')}{first.length > 2 ? ` +${first.length - 2}` : ''}</span> {friends.length === 1 ? 'has' : 'have'} been to {destination}</span></span>}
      {savers.total > 0 && <span className="inline-flex items-center gap-1"><Bookmark size={12} aria-hidden="true" />{savers.total} {savers.total === 1 ? 'traveler' : 'travelers'} saved a trip here</span>}
      <span className="text-link underline underline-offset-2">See who</span>
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} onClose={() => setOpen(false)}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}
      className="panel m-auto w-[min(92vw,420px)] p-0 text-ink shadow-pop backdrop:bg-ink/50">
      {open && <div className="flex max-h-[75dvh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line-soft p-5 pb-3">
          <div>
            <h2 id={titleId} className="type-title normal-case">{destination}</h2>
            <p className="mt-1 text-sm text-muted">About this destination, not one place.</p>
          </div>
          <button type="button" autoFocus aria-label="Close" onClick={() => dialog.current?.close()} className="flex size-10 shrink-0 items-center justify-center rounded-full"><X size={18} /></button>
        </header>
        <div className="space-y-4 overflow-y-auto px-5 py-3">
          {friends.length > 0 && <section><h3 className="type-label">Friends who’ve been</h3>
            <ul>{friends.map(friend => <li key={friend.itineraryId} className="flex items-center gap-2 border-b border-line-soft py-3 last:border-0">
              <span className="font-semibold text-link">{friend.name}</span>
              <Link href={`/itinerary/${friend.itineraryId}`} onClick={() => dialog.current?.close()} className="ml-auto text-sm text-link underline underline-offset-2">See trip →</Link>
            </li>)}</ul></section>}
          {savers.total > 0 && <section><h3 className="type-label">Saved a trip to {destination}</h3>
            <p className="py-3 text-sm">{savers.names.length > 0 && <span className="font-semibold text-link">{savers.names.join(', ')}</span>}{savers.names.length > 0 && others > 0 && ' and '}{others > 0 && `${others} ${others === 1 ? 'other traveler' : 'other travelers'}`}</p></section>}
        </div>
      </div>}
    </dialog>
  </>
}
