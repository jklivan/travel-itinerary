'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { destinationPeople } from '@/actions/likes'
import UserAvatar from './UserAvatar'
import BottomSheet from './ui/BottomSheet'

type Person = { id: string; name: string; image: string | null; tripId: string; tripTitle: string }

// "Joshua also visited" / "Saved by 3 travelers" on a trip's destination: tap to see who, with a link to their trip.
function Sheet({ itineraryId, destination, kind, onClose }: { itineraryId: string; destination: string; kind: 'visited' | 'saved'; onClose: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    destinationPeople(itineraryId, destination).then(result => {
      if (!active) return
      if (result.error) setError('These travelers aren’t available.')
      setPeople(result[kind])
    }, () => { if (active) setError('Could not load. Please try again.') })
    return () => { active = false }
  }, [itineraryId, destination, kind])
  const title = kind === 'visited' ? 'Friends who went' : 'Saved by'
  return <BottomSheet title={title} label={`${title} — ${destination}`} onClose={onClose}>
    <p className="mb-3 text-sm text-muted">{kind === 'visited' ? `People you follow who shared a trip to ${destination}.` : `Travelers who saved a trip to ${destination}.`}</p>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p>
      : people === null ? <p className="text-sm text-muted">Loading…</p>
      : !people.length ? <p className="py-8 text-center text-sm text-muted">No one yet.</p>
      : <ul className="space-y-3">{people.map(person => <li key={person.id} className="flex items-center gap-3">
        <Link href={`/user/${person.id}`} className="shrink-0"><UserAvatar name={person.name} image={person.image} size={40} /></Link>
        <span className="min-w-0 flex-1"><Link href={`/user/${person.id}`} className="block truncate text-sm font-semibold text-ink hover:underline">{person.name}</Link>
          <Link href={`/itinerary/${person.tripId}`} className="block truncate text-xs text-link hover:underline">{kind === 'saved' ? 'Saved ' : ''}{person.tripTitle} →</Link></span>
      </li>)}</ul>}
  </BottomSheet>
}

export default function DestinationPeopleButton({ itineraryId, destination, kind, children }: { itineraryId: string; destination: string; kind: 'visited' | 'saved'; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)} className="text-left underline-offset-2 hover:underline">{children}</button>
    {open && <Sheet itineraryId={itineraryId} destination={destination} kind={kind} onClose={() => setOpen(false)} />}
  </>
}
