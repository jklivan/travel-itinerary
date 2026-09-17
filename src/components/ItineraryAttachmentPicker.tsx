'use client'

import { useEffect, useState } from 'react'
import { messageItineraries } from '@/actions/messages'

type Trip = Awaited<ReturnType<typeof messageItineraries>>[number]

export default function ItineraryAttachmentPicker({ onSelect, disabled = false }: { onSelect: (trip: Trip) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('')
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void messageItineraries(query).then(result => {
        if (active) { setTrips(result); setLoading(false) }
      }).catch(() => { if (active) { setError('Could not load your itineraries. Please try again.'); setLoading(false) } })
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [query, attempt])
  return <section aria-label="Your itineraries" className="space-y-3 rounded-xl border border-[#d7cebc] bg-[#fffdf6] p-3">
    <label className="block text-sm font-semibold text-[#2e4147]">Choose from your itineraries
      <input type="search" aria-label="Search your itineraries" disabled={disabled} value={query} maxLength={160} onChange={event => { setQuery(event.target.value); setLoading(true); setError('') }} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} placeholder="Search by title…" className="mt-2 w-full rounded-lg border border-[#8caaa3] bg-white p-2 text-base font-normal" />
    </label>
    <p className="text-xs text-[#8B6F4E]">Your shared trips and guides. Publish an in-progress trip before attaching it.</p>
    {loading ? <p role="status" className="text-sm">Loading your itineraries…</p> : error ? <div role="alert" className="text-sm text-red-700">{error}<button type="button" disabled={disabled} className="ml-2 underline" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>Retry</button></div> : trips.length ? <ul className="max-h-64 space-y-1 overflow-y-auto">{trips.map(trip => <li key={trip.id}><button type="button" disabled={disabled} onClick={() => onSelect(trip)} className="min-h-11 w-full break-words rounded-lg p-3 text-left text-sm font-medium text-[#2e4147] hover:bg-[#e6ece5]">{trip.title}</button></li>)}</ul> : <p role="status" className="text-sm text-[#8B6F4E]">{query ? 'No matching itineraries.' : 'You don’t have any shared itineraries yet.'}</p>}
  </section>
}
