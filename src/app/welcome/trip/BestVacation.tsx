'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import TagChip from '@/components/ui/TagChip'
import { TAGS } from '@/lib/tags'
import { TRAVELERS } from '@/lib/travelPreferences'
import { saveBestVacation } from '@/actions/onboarding'

const WHO: Record<typeof TRAVELERS[number], string> = { Solo: 'Just me', Couple: 'Couple', 'Family with kids': 'Family', Friends: 'Friends' }

// After following people at sign-up: four quick questions about their best vacation, one at a time. Every step can
// be skipped; the answers become a private trip the planner learns their taste from.
export default function BestVacation({ next }: { next: string }) {
  const [step, setStep] = useState(0)
  const [destination, setDestination] = useState('')
  const [travelers, setTravelers] = useState('')
  const [hotel, setHotel] = useState(''), [hotelPlaceId, setHotelPlaceId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const town = destination.split(',')[0].trim()

  async function finish() {
    if (!destination.trim()) { window.location.assign(next); return }
    setBusy(true); setError('')
    try {
      const result = await saveBestVacation({ destination, travelers, hotel: hotel.trim() ? { name: hotel.trim(), placeId: hotelPlaceId } : null, tags })
      if (result.error) { setError(result.error); setBusy(false) } else window.location.assign(next)
    } catch { setError('Could not save. Please try again.'); setBusy(false) }
  }
  const steps = [
    { title: 'Think of your best vacation. Where was it?', hint: 'A city, an island, a whole country: wherever it was.', ready: !!destination.trim(),
      body: <PlacesAutocomplete value={destination} onChange={setDestination} onSelect={(main, secondary) => setDestination([main, secondary].filter(Boolean).join(', '))} type="destination" maxLength={160} placeholder="e.g. Amalfi Coast, Tokyo, Maui…" className="field" autoFocus /> },
    { title: 'Who were you with?', ready: !!travelers,
      body: <div className="flex flex-wrap gap-2">{TRAVELERS.map(option => <button key={option} type="button" aria-pressed={travelers === option} onClick={() => setTravelers(option)} className="chip">{WHO[option]}</button>)}</div> },
    { title: 'Where did you stay?', hint: 'A hotel, a villa, a friend’s place: whatever you remember.', ready: !!hotel.trim(),
      body: <PlacesAutocomplete value={hotel} onChange={value => { setHotel(value); setHotelPlaceId(null) }} onSelect={(main, _secondary, placeId) => { setHotel(main); setHotelPlaceId(placeId ?? null) }} type="hotel" city={town || undefined} maxLength={240} placeholder="Hotel name" className="field" /> },
    { title: 'What did you do?', hint: 'Pick as many as you like.', ready: tags.length > 0,
      body: <div className="flex flex-wrap gap-2">{TAGS.filter(tag => tag.id !== 'day-trip').map(tag => <TagChip key={tag.id} id={tag.id} selected={tags.includes(tag.id)} onToggle={() => setTags(list => list.includes(tag.id) ? list.filter(item => item !== tag.id) : [...list, tag.id])} />)}</div> },
  ]
  const current = steps[step]
  const last = step === steps.length - 1

  return <div className="page-wrap">
    <header className="page-header">
      <p className="type-label text-link">Step {step + 1} of {steps.length}</p>
      <h1 className="page-title mt-1">{current.title}</h1>
      {current.hint && <p className="page-subtitle">{current.hint}</p>}
    </header>
    <div className="mb-4 flex gap-1.5" aria-hidden="true">{steps.map((_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-ink' : 'bg-line'}`} />)}</div>
    <div className="panel p-5">{current.body}</div>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    <div className="mt-6 flex items-center gap-3">
      {step > 0 && <button type="button" disabled={busy} onClick={() => setStep(step - 1)} className="btn btn-outline"><ArrowLeft size={18} />Back</button>}
      <button type="button" disabled={busy || (step === 0 && !current.ready)} onClick={() => last ? void finish() : setStep(step + 1)} className="btn btn-primary flex-1">
        {busy ? 'Saving…' : last ? 'Finish' : current.ready ? 'Next' : 'Skip'}<ArrowRight size={18} /></button>
    </div>
    <p className="mt-4 text-center text-sm"><button type="button" disabled={busy} onClick={() => window.location.assign(next)} className="text-link underline">Skip all of this</button></p>
  </div>
}
