'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { ArrowUp, Building2, ChevronRight, Heart, Mountain, Sparkles, Tag, Umbrella, User, Users, UsersRound, Utensils } from 'lucide-react'
import PostcardLogo from '@/components/PostcardLogo'
import { picksQuestion, type TravelPreferences } from '@/lib/travelPreferences'
import { formatDate } from '@/lib/placeDates'

// Nothing extra is loaded for the start page; kept as a type so the page can say it's showing it.
export type Landing = Record<string, never>

// The three rows of choices under the question: pick any vibes, one "with", one budget ("All" = no preference).
const VIBES = [{ value: 'Beach', label: 'Beach', icon: <Umbrella size={14} /> }, { value: 'City', label: 'City', icon: <Building2 size={14} /> },
  { value: 'Adventure', label: 'Adventure', icon: <Mountain size={14} /> }, { value: 'Food & wine', label: 'Food', icon: <Utensils size={14} /> }]
const WITH = [{ value: 'Solo', label: 'Just us', icon: <User size={14} /> }, { value: 'Family with kids', label: 'Family', icon: <UsersRound size={14} /> },
  { value: 'Friends', label: 'Group trip', icon: <Users size={14} /> }, { value: 'Couple', label: 'Couples', icon: <Heart size={14} /> }]
const BUDGET = [{ value: 1, label: 'Budget', signs: '$' }, { value: 2, label: 'Mid-range', signs: '$$' }, { value: 4, label: 'Luxury', signs: '$$$' }, { value: 0, label: 'All', signs: '' }]

// Plan with Postcard's start page (the bottom bar's Plan button): ask where to go, narrowed by vibe, who's going and
// budget if they like, or reopen a past chat.
export default function PlanLanding({ history, busy, onSend }: { landing: Landing; history: { id: string; topic: string }[]; busy: boolean; onSend: (text: string, preferences?: TravelPreferences) => void }) {
  const [text, setText] = useState('')
  const [vibes, setVibes] = useState<string[]>([])
  const [travelers, setTravelers] = useState('')
  const [budget, setBudget] = useState(0)
  const [allChats, setAllChats] = useState(false)
  const preferences = (): TravelPreferences | undefined => vibes.length || travelers || budget
    ? { travelers, length: '', budget: budget || null, destinationTypes: [], activities: [], ...(vibes.length && { vibes }) } : undefined
  function submit() {
    const prefs = preferences()
    // Only choices made: the question says them in words ("Show me trip ideas for a couple, with a beach vibe…").
    const message = text.trim() || (prefs ? picksQuestion(prefs, formatDate) : '')
    if (message && !busy) onSend(message, prefs)
  }
  // One line per row (swipe sideways on a narrow phone), its label on the left.
  const row = (label: string, chips: ReactNode) => <div className="flex items-center gap-2">
    <span className="type-label w-14 shrink-0 text-muted">{label}</span>
    <div className="-mr-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{chips}</div>
  </div>
  const chats = allChats ? history : history.slice(0, 3)

  return <div className="mx-auto max-w-2xl px-4 py-7 text-ink">
    <header className="relative mb-5 px-1">
      <h1 className="type-display max-w-sm pr-20 sm:pr-8">Plan with Postcard</h1>
      <PostcardLogo size={84} className="absolute -top-1 right-0 rotate-[8deg]" />
      <p className="mt-2 max-w-sm text-sm text-muted">Ideas, itineraries, hotels and restaurants, based on what you and your friends love.</p>
    </header>

    <form className="panel flex items-center gap-3 p-3" onSubmit={event => { event.preventDefault(); submit() }}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Sparkles size={18} /></span>
      <label className="min-w-0 flex-1"><span className="sr-only">Where do you want to go?</span>
        <input value={text} onChange={event => setText(event.target.value)} maxLength={4000} placeholder="Where do you want to go?" className="field" /></label>
      <button type="submit" disabled={busy || (!text.trim() && !preferences())} aria-label="Ask Postcard" className="btn btn-primary w-11 shrink-0 !px-0"><ArrowUp size={18} /></button>
    </form>
    <p className="mt-2 px-1 text-xs text-muted">Try “A long weekend in Italy with kids”</p>

    <div className="mt-5 space-y-3">
      {row('Vibe', VIBES.map(option => { const on = vibes.includes(option.value); return <button key={option.value} type="button" aria-pressed={on} onClick={() => setVibes(list => on ? list.filter(item => item !== option.value) : [...list, option.value])} className="chip">{option.icon}{option.label}</button> }))}
      {row('With friends', WITH.map(option => <button key={option.value} type="button" aria-pressed={travelers === option.value} onClick={() => setTravelers(current => current === option.value ? '' : option.value)} className="chip">{option.icon}{option.label}</button>))}
      {row('Budget', BUDGET.map(option => <button key={option.value} type="button" aria-pressed={budget === option.value} onClick={() => setBudget(option.value)} className="chip">
        {option.signs ? <span aria-hidden="true" className="font-semibold">{option.signs}</span> : <Tag size={14} />}{option.label}</button>))}
    </div>

    {history.length > 0 && <section className="mt-8" aria-labelledby="chats-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="chats-heading" className="type-title">Past chats</h2>
        {history.length > 3 && <button type="button" onClick={() => setAllChats(open => !open)} className="inline-flex shrink-0 items-center text-sm text-link">{allChats ? 'Show fewer' : 'See all'}<ChevronRight size={16} /></button>}</div>
      <div className="space-y-2">{chats.map(chat => <Link key={chat.id} href={`/testplan?chat=${chat.id}`} className="panel flex items-center gap-3 px-4 py-3 text-sm text-ink transition-colors hover:bg-cream">
        <span className="min-w-0 flex-1 truncate">{chat.topic}</span><ChevronRight size={18} className="shrink-0 text-link" /></Link>)}</div>
    </section>}

    <p className="mt-8 text-center text-sm"><Link href="/plan" className="text-link underline">Start a plan without AI</Link></p>
  </div>
}
