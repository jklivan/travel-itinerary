'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import TagChip from '@/components/ui/TagChip'
import { TAGS } from '@/lib/tags'
import { BUDGETS, STAYS, TRAVELERS } from '@/lib/travelPreferences'
import { saveTravelStyle } from '@/actions/onboarding'

const WHO: Record<typeof TRAVELERS[number], string> = { Solo: 'Just me', Couple: 'Couple', 'Family with kids': 'Family', Friends: 'Friends' }
const ACTIVITIES = TAGS.filter(tag => tag.id !== 'day-trip').map(tag => tag.id)

// After following people at sign-up: "How you like to travel", four quick questions to tap through (pick one, several
// or all; any can be skipped). The planner uses the answers to tailor its recommendations until they've added trips.
export default function BestVacation({ next }: { next: string }) {
  const [step, setStep] = useState(0)
  const [travelers, setTravelers] = useState<string[]>([])
  const [budget, setBudget] = useState<number | null>(null)
  const [stays, setStays] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function finish() {
    setBusy(true); setError('')
    try {
      const result = await saveTravelStyle({ travelers, budget, stays, tags })
      if (result.error) { setError(result.error); setBusy(false) } else window.location.assign(next)
    } catch { setError('Could not save. Please try again.'); setBusy(false) }
  }
  const toggle = (set: (update: (list: string[]) => string[]) => void, value: string) => set(list => list.includes(value) ? list.filter(item => item !== value) : [...list, value])
  // "All of these" for the pick-as-many questions.
  const all = (list: string[], options: readonly string[], set: (value: string[]) => void) => <button type="button" aria-pressed={list.length === options.length} onClick={() => set(list.length === options.length ? [] : [...options])} className="chip">{list.length === options.length && <Check size={14} />}All of these</button>
  const steps = [
    { title: 'Who do you usually travel with?', hint: 'Pick as many as you like.', ready: travelers.length > 0,
      body: <div className="flex flex-wrap gap-2">{TRAVELERS.map(option => <button key={option} type="button" aria-pressed={travelers.includes(option)} onClick={() => toggle(setTravelers, option)} className="chip">{travelers.includes(option) && <Check size={14} />}{WHO[option]}</button>)}{all(travelers, TRAVELERS, setTravelers)}</div> },
    { title: 'What’s your usual budget?', ready: budget !== null,
      body: <div className="flex flex-wrap gap-2">{BUDGETS.map(option => <button key={option.value} type="button" aria-pressed={budget === option.value} onClick={() => setBudget(budget === option.value ? null : option.value)} className="chip"><span className="font-semibold">{option.label}</span> {option.hint}</button>)}</div> },
    { title: 'Where do you like to stay?', hint: 'Pick as many as you like.', ready: stays.length > 0,
      body: <div className="flex flex-wrap gap-2">{STAYS.map(option => <button key={option} type="button" aria-pressed={stays.includes(option)} onClick={() => toggle(setStays, option)} className="chip">{stays.includes(option) && <Check size={14} />}{option}</button>)}{all(stays, STAYS, setStays)}</div> },
    { title: 'What do you like to do?', hint: 'Pick as many as you like.', ready: tags.length > 0,
      body: <div className="flex flex-wrap gap-2">{ACTIVITIES.map(id => <TagChip key={id} id={id} selected={tags.includes(id)} onToggle={() => toggle(setTags, id)} />)}{all(tags, ACTIVITIES, setTags)}</div> },
  ]
  const current = steps[step]
  const last = step === steps.length - 1

  return <div className="page-wrap">
    {/* Why we ask, before the first question. */}
    {step === 0 && <p className="panel-hint mb-5 p-3 text-sm text-ink">So Postcard can tailor its recommendations to you, a few quick questions about how you like to travel.</p>}
    <header className="page-header">
      <p className="type-label text-link">How you like to travel · {step + 1} of {steps.length}</p>
      <h1 className="page-title mt-1">{current.title}</h1>
      {current.hint && <p className="page-subtitle">{current.hint}</p>}
    </header>
    <div className="mb-4 flex gap-1.5" aria-hidden="true">{steps.map((_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-ink' : 'bg-line'}`} />)}</div>
    <div className="panel p-5">{current.body}</div>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    <div className="mt-6 flex items-center gap-3">
      {step > 0 && <button type="button" disabled={busy} onClick={() => setStep(step - 1)} className="btn btn-outline"><ArrowLeft size={18} />Back</button>}
      <button type="button" disabled={busy} onClick={() => last ? void finish() : setStep(step + 1)} className="btn btn-primary flex-1">
        {busy ? 'Saving…' : last ? 'Finish' : current.ready ? 'Next' : 'Skip'}<ArrowRight size={18} /></button>
    </div>
    <p className="mt-4 text-center text-sm"><button type="button" disabled={busy} onClick={() => window.location.assign(next)} className="text-link underline">Skip all of this</button></p>
  </div>
}
