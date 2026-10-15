'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { ArrowRight, ArrowUp, Bookmark, CalendarDays, Check, ChevronRight, Gem, Heart, Hotel, Landmark, MapPin, Mountain, SlidersHorizontal, Sparkles, Sun, Trees, Users, Utensils, Waves, Wine } from 'lucide-react'
import PostcardLogo from '@/components/PostcardLogo'
import TripCover from '@/components/TripCover'
import UserAvatar from '@/components/UserAvatar'
import { DISTANCES, SETUP_MESSAGE, TRAVELER_LABELS, TRAVELERS, VIBES, WHEN, type TravelPreferences } from '@/lib/travelPreferences'
import { formatDate } from '@/lib/placeDates'

export type Landing = {
  plans: { id: string; title: string; places: number; dates: { start: string; end: string } | null; cover: { saved: string | null; itemId: string | null; stock: string | null } }[]
  saved: { type: 'food_drink' | 'hotel' | 'activity'; count: number; photo: string | null }[]
  friends: { id: string; name: string; image: string | null }[]
}

type Panel = 'nearby' | 'dates' | 'friends' | 'vibe'
const VIBE_ICONS: Record<typeof VIBES[number], ReactNode> = { Relaxing: <Sun size={16} />, Adventure: <Mountain size={16} />, 'Food & wine': <Wine size={16} />, Luxury: <Gem size={16} />, Culture: <Landmark size={16} />, 'Family fun': <Heart size={16} />, Beach: <Waves size={16} />, Outdoors: <Trees size={16} /> }
const SAVED = {
  food_drink: { title: 'Saved restaurants', icon: <Utensils size={22} />, ask: 'Plan a trip around the restaurants in the trips I’ve saved.' },
  hotel: { title: 'Saved hotels', icon: <Hotel size={22} />, ask: 'Plan a trip around the hotels in the trips I’ve saved.' },
  activity: { title: 'Saved places', icon: <MapPin size={22} />, ask: 'Build an itinerary from the places in the trips I’ve saved.' },
}

// Plan with Postcard's start page (the bottom bar's Plan button): ask where to go, optionally narrowed with
// Somewhere nearby, Dates, With friends and Vibe (each opens a small panel; its choices go with the question),
// or start from saved places or a plan in progress.
export default function PlanLanding({ landing, history, busy, onSend }: { landing: Landing; history: { id: string; topic: string }[]; busy: boolean; onSend: (text: string, preferences?: TravelPreferences) => void }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState<Panel | null>(null)
  const [when, setWhen] = useState(''), [startDate, setStartDate] = useState(''), [endDate, setEndDate] = useState('')
  const [distance, setDistance] = useState(''), [from, setFrom] = useState('')
  const [travelers, setTravelers] = useState(''), [friendIds, setFriendIds] = useState<string[]>([])
  const [vibes, setVibes] = useState<string[]>([])
  const set: Record<Panel, boolean> = { nearby: !!distance, dates: !!when, friends: !!travelers || friendIds.length > 0, vibe: vibes.length > 0 }
  const preferences = (): TravelPreferences | undefined => Object.values(set).some(Boolean) ? {
    travelers, length: '', budget: null, destinationTypes: [], activities: [],
    ...(when && { when }), ...(when === 'Specific dates' && startDate && { startDate, ...(endDate && { endDate }) }),
    ...(distance && { distance, ...(from.trim() && { from: from.trim() }) }), ...(vibes.length && { vibes }),
    ...(friendIds.length && { friendIds, friends: landing.friends.filter(friend => friendIds.includes(friend.id)).map(friend => friend.name) }),
  } : undefined
  function submit(question = text) {
    const prefs = preferences()
    const message = question.trim() || (prefs ? SETUP_MESSAGE : '')
    if (message && !busy) onSend(message, prefs)
  }
  const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(item => item !== value) : [...list, value]
  const chips: { panel: Panel; label: string; icon: ReactNode }[] = [
    { panel: 'nearby', label: 'Somewhere nearby', icon: <MapPin size={14} /> },
    { panel: 'dates', label: 'Dates', icon: <CalendarDays size={14} /> },
    { panel: 'friends', label: 'With friends', icon: <Users size={14} /> },
    { panel: 'vibe', label: 'Vibe', icon: <SlidersHorizontal size={14} /> },
  ]
  const saved = landing.saved.filter(group => group.count > 0)

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

    <div className="mt-4 flex flex-wrap gap-2">
      {chips.map(chip => <button key={chip.panel} type="button" aria-pressed={open === chip.panel || set[chip.panel]} aria-expanded={open === chip.panel} onClick={() => setOpen(current => current === chip.panel ? null : chip.panel)} className="chip">
        {set[chip.panel] && open !== chip.panel ? <Check size={14} /> : chip.icon}{chip.label}</button>)}
    </div>

    {open && <section className="panel mt-3 space-y-4 p-4" aria-label={chips.find(chip => chip.panel === open)?.label}>
      {open === 'nearby' && <>
        <PanelHeading icon={<MapPin size={18} />} title="Somewhere nearby" hint="Places within easy reach of where you’re starting." />
        <Options legend="How far are you willing to travel?" name="distance" options={DISTANCES} value={distance} onChange={setDistance} />
        <label className="block text-sm">Leaving from <span className="text-muted">(optional)</span><input value={from} onChange={event => setFrom(event.target.value)} maxLength={80} placeholder="Your town or city" className="field mt-1" /></label>
      </>}
      {open === 'dates' && <>
        <PanelHeading icon={<CalendarDays size={18} />} title="When are you traveling?" />
        <Options legend="When" name="when" options={WHEN} value={when} onChange={setWhen} hideLegend />
        {when === 'Specific dates' && <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0 text-sm">From<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="field mt-1" /></label>
          <label className="block min-w-0 text-sm">To<input type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} className="field mt-1" /></label>
        </div>}
      </>}
      {open === 'friends' && <>
        <PanelHeading icon={<Users size={18} />} title="Who’s coming along?" />
        <Options legend="Who’s coming" name="travelers" options={TRAVELERS} labels={TRAVELER_LABELS} value={travelers} onChange={setTravelers} hideLegend />
        {landing.friends.length > 0 && <fieldset>
          <legend className="mb-2 text-sm">Use places these friends loved <span className="text-muted">(optional)</span></legend>
          <div className="flex flex-wrap gap-2">{landing.friends.map(friend => <button key={friend.id} type="button" aria-pressed={friendIds.includes(friend.id)} onClick={() => setFriendIds(list => toggle(list, friend.id))} className="chip">
            <UserAvatar name={friend.name} image={friend.image} size={20} />{friend.name.split(' ')[0]}</button>)}</div>
        </fieldset>}
      </>}
      {open === 'vibe' && <>
        <PanelHeading icon={<SlidersHorizontal size={18} />} title="What’s your travel vibe?" hint="Choose as many as you like." />
        <div className="grid grid-cols-2 gap-2">{VIBES.map(vibe => <button key={vibe} type="button" aria-pressed={vibes.includes(vibe)} onClick={() => setVibes(list => toggle(list, vibe))} className="chip justify-start">
          {VIBE_ICONS[vibe]}{vibe}{vibes.includes(vibe) && <Check size={14} className="ml-auto" />}</button>)}</div>
      </>}
      <button type="button" onClick={() => setOpen(null)} className="btn btn-primary w-full">Apply &amp; continue<ArrowRight size={18} /></button>
    </section>}

    {saved.length > 0 && <section className="mt-8" aria-labelledby="saved-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="saved-heading" className="type-title">Plan from your saved places</h2><Link href="/saved" className="inline-flex shrink-0 items-center text-sm text-link">See all<ChevronRight size={16} /></Link></div>
      <div className="grid grid-cols-3 gap-3">{saved.map(group => <button key={group.type} type="button" disabled={busy} onClick={() => submit(SAVED[group.type].ask)} className="min-w-0 text-left">
        <span className="photo-polaroid block"><span className="photo-polaroid-image relative grid place-items-center bg-chip text-brown">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {group.photo ? <img src={group.photo} alt="" className="absolute inset-0 h-full w-full object-cover" /> : SAVED[group.type].icon}
          <span className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-card text-link"><Bookmark size={14} /></span>
        </span></span>
        <span className="mt-2 block font-[family-name:var(--font-playfair)] text-sm leading-tight text-ink">{SAVED[group.type].title}</span>
        <span className="block text-xs text-muted">{group.count} {group.count === 1 ? 'place' : 'places'}</span>
      </button>)}</div>
    </section>}

    {landing.plans.length > 0 && <section className="mt-8" aria-labelledby="continue-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="continue-heading" className="type-title">Continue planning</h2><Link href="/trips" className="inline-flex shrink-0 items-center text-sm text-link">See all<ChevronRight size={16} /></Link></div>
      <div className="space-y-3">{landing.plans.map(plan => <Link key={plan.id} href={`/plan/${plan.id}`} className="panel flex items-center gap-4 p-3 shadow-card transition-colors hover:bg-chip">
        <span className="photo-polaroid w-24 shrink-0"><span className="photo-polaroid-image"><TripCover {...plan.cover} /></span></span>
        <span className="min-w-0 flex-1"><span className="block break-words font-[family-name:var(--font-playfair)] text-lg leading-tight text-ink">{plan.title}</span>
          <span className="mt-1 block text-sm text-muted">{[plan.dates && `${formatDate(plan.dates.start)} – ${formatDate(plan.dates.end)}`, `${plan.places} ${plan.places === 1 ? 'place' : 'places'} saved`].filter(Boolean).join(' · ')}</span></span>
        <ChevronRight size={18} className="shrink-0 text-link" />
      </Link>)}</div>
    </section>}

    {history.length > 0 && <section className="mt-8" aria-labelledby="chats-heading">
      <h2 id="chats-heading" className="type-title mb-3">Past chats</h2>
      <div className="panel divide-y divide-line-soft">{history.slice(0, 3).map(chat => <Link key={chat.id} href={`/testplan?chat=${chat.id}`} className="flex items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-cream"><span className="min-w-0 flex-1 truncate">{chat.topic}</span><ChevronRight size={16} className="shrink-0 text-link" /></Link>)}</div>
    </section>}

    <p className="mt-8 text-center text-sm"><Link href="/plan" className="text-link underline">Start a plan without AI</Link></p>
  </div>
}

function PanelHeading({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return <div><h2 className="type-title flex items-center gap-2"><span className="text-link">{icon}</span>{title}</h2>{hint && <p className="mt-1 text-sm text-muted">{hint}</p>}</div>
}

// Choose one: hidden radios with chips, the shared radio style (navy when chosen). Tapping the chosen one clears it.
function Options<T extends string>({ legend, name, options, labels, value, onChange, hideLegend = false }: { legend: string; name: string; options: readonly T[]; labels?: Record<T, string>; value: string; onChange: (value: string) => void; hideLegend?: boolean }) {
  return <fieldset><legend className={hideLegend ? 'sr-only' : 'mb-2 text-sm'}>{legend}</legend>
    <div className="flex flex-wrap gap-2">{options.map(option => <label key={option}><input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} onClick={() => { if (value === option) onChange('') }} className="sr-only" /><span className="chip">{labels?.[option] ?? option}</span></label>)}</div>
  </fieldset>
}
