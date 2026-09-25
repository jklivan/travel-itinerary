'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowUpRight, Camera, Check, EyeOff, Hotel, Map as MapIcon, Maximize2, Minimize2, Plane, Plus, Sparkles, Users, Utensils, MapPin, SquarePen, X } from 'lucide-react'
import styles from '../itinerary/[id]/places.module.css'
import planningStyles from '../plan/[id]/Planner.module.css'
import detailStyles from '@/components/PlaceDetailsCard.module.css'
import ItineraryMap from '@/components/ItineraryMap'
import type { ItemPin } from '@/components/ItineraryMapInner'
import PlacePhoto from '@/components/PlacePhoto'
import { addPlanPlace, startPlan } from '@/actions/planning'
import { linkPlanChat } from '@/actions/planChat'
import { tripMapLookupKey, validMapLocation, type TripMapPlace } from '@/lib/tripMapPlaces'
import { ACTIVITIES, BUDGETS, DESTINATION_TYPES, TRAVELERS, TRIP_LENGTHS, type TravelPreferences } from '@/lib/travelPreferences'

type Place = { id: string; name: string; type: string; notes: string | null; placeId: string | null; lat: number | null; lng: number | null; day: number | null; photos: string[]; destination: string }
type Trip = { id: string; title: string; places: Place[] }
type Recommendation = { key: string; name: string; type: 'hotel' | 'food_drink' | 'activity'; why: string; destination: string; country: string | null; tripOption?: string; description?: string; source: 'friend' | 'you' | 'claude'; friendName: string; sourceItemId: string; placeId: string | null; lat: number | null; lng: number | null }
export type Turn = { role: 'user'; text: string } | { role: 'assistant'; text: string; recommendations: Recommendation[] } | { role: 'preferences'; preferences: TravelPreferences }
type MapPlace = TripMapPlace & { lat: number | null; lng: number | null; color?: string; label?: string }

const categories = [{ value: 'hotel', label: 'Hotels', eyebrow: 'Stay', Icon: Hotel }, { value: 'food_drink', label: 'Restaurants', eyebrow: 'Food & drink', Icon: Utensils }, { value: 'activity', label: 'Activities', eyebrow: 'Explore', Icon: Camera }, { value: 'transport', label: 'Transportation', eyebrow: 'Getting around', Icon: Plane }]
// One color per trip idea Claude suggests, chosen to stay distinct from the day colors used for the trip itself.
const optionColors = ['#c2410c', '#1d4ed8', '#7e22ce', '#0f766e', '#be185d', '#a16207', '#4d7c0f', '#b91c1c']
// Older saved chats have no tripOption, so fall back to grouping by country.
const optionOf = (rec: Recommendation) => rec.tripOption || rec.country || rec.destination

// Order within each suggested destination: where to stay, then what to do, then where to eat.
const sectionOrder = [{ type: 'hotel', label: 'Where to stay', Icon: Hotel }, { type: 'activity', label: 'Things to do', Icon: Camera }, { type: 'food_drink', label: 'Where to eat', Icon: Utensils }] as const
function groupByOption(recs: Recommendation[]) {
  const groups = new Map<string, Recommendation[]>()
  for (const rec of recs) groups.set(optionOf(rec), [...(groups.get(optionOf(rec)) ?? []), rec])
  return [...groups.entries()]
}

const starters = ['Surprise me with a long weekend', 'Where should we go this spring?', 'Somewhere new my friends haven’t been']

export default function TestPlanner({ trip, chat, hasOwnTrips, lastPreferences }: { trip: Trip | null; chat: { id: string; turns: Turn[] } | null; hasOwnTrips: boolean; lastPreferences: TravelPreferences | null }) {
  const router = useRouter()
  const [turns, setTurns] = useState<Turn[]>(chat?.turns ?? [])
  const chatId = useRef(chat?.id ?? '')
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  const [mapView, setMapView] = useState<'normal' | 'small' | 'hidden'>('normal')
  const [skippedSetup, setSkippedSetup] = useState(false)
  const tripId = useRef(trip?.id ?? '')
  const scroller = useRef<HTMLDivElement>(null)
  const endOfChat = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    const box = scroller.current
    // Desktop: the messages scroll inside their panel. Phones: they flow with the page, so bring the
    // newest message into view instead (not on first load, so the page opens at the top).
    if (box && box.scrollHeight > box.clientHeight) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
    else if (!firstRender.current) endOfChat.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    firstRender.current = false
  }, [turns, thinking])

  const places = trip?.places ?? []
  const inTrip = (rec: Recommendation) => added.has(rec.key) || places.some(place => place.name.trim().toLowerCase() === rec.name.trim().toLowerCase())
  const allRecommendations = turns.flatMap(turn => turn.role === 'assistant' ? turn.recommendations : [])
  const options = [...new Set(allRecommendations.map(optionOf))]
  const colorOf = (rec: Recommendation) => optionColors[options.indexOf(optionOf(rec)) % optionColors.length]
  // Every suggestion from the conversation that isn't in the trip yet, once per place.
  const suggestions = [...new Map(allRecommendations.filter(rec => !inTrip(rec)).map(rec => [`${rec.name}|${rec.destination}`.toLowerCase(), rec])).values()]
  const legend = options.filter(option => suggestions.some(rec => optionOf(rec) === option))
  const mapPlaces: MapPlace[] = [
    ...places.filter(place => place.type !== 'transport' || place.placeId || validMapLocation(place)).map(place => ({ id: place.id, name: place.name, city: place.destination, type: place.type as MapPlace['type'], day: place.day, placeId: place.placeId ?? undefined, lat: place.lat, lng: place.lng })),
    // The plain name is what gets located on the map; "Suggested" only belongs in the pin's label.
    ...suggestions.map(rec => ({ id: rec.key, name: rec.name, city: [rec.destination, rec.country].filter(Boolean).join(', '), type: rec.type, day: null, placeId: rec.placeId ?? undefined, lat: rec.lat, lng: rec.lng, color: colorOf(rec), label: `Suggested · ${optionOf(rec)}` })),
  ]

  async function send(text: string, preferences?: TravelPreferences) {
    const message = text.trim()
    if (!message || thinking) return
    setThinking(true); setError(''); setDraft('')
    const pending: Turn[] = [...(preferences ? [{ role: 'preferences' as const, preferences }] : []), { role: 'user', text: message }]
    setTurns(current => [...current, ...pending])
    try {
      const response = await fetch('/api/testplan/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: chatId.current, message, tripId: tripId.current, preferences }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Something went wrong.')
      chatId.current = data.chatId
      setTurns(current => [...current, { role: 'assistant', text: data.reply, recommendations: data.recommendations }])
    } catch (caught) {
      setTurns(current => current.slice(0, -pending.length)); if (!preferences) setDraft(message)
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
    } finally { setThinking(false) }
  }

  async function add(rec: Recommendation) {
    if (adding) return
    setAdding(rec.key); setError('')
    const destination = [rec.destination, rec.country].filter(Boolean).join(', ')
    try {
      let created = false
      if (!tripId.current) {
        const form = new FormData()
        for (const [key, value] of Object.entries({ clientId: crypto.randomUUID(), title: '', destination, audience: 'family', format: 'itinerary', startDate: '', endDate: '' })) form.set(key, value)
        const result = await startPlan(form)
        if (result.error || !result.id) throw new Error(result.error || 'Could not start the trip.')
        tripId.current = result.id; created = true
        if (chatId.current) await linkPlanChat(chatId.current, result.id)
      }
      const form = new FormData()
      for (const [key, value] of Object.entries({ name: rec.name, type: rec.type, destination, notes: `${rec.why}${rec.friendName ? ` — via ${rec.friendName}` : ''}`, clientId: crypto.randomUUID(), day: '' })) form.set(key, value)
      // Save the place's Google ID (from the same lookup the pick's pop-out uses), so the planner can show
      // its photo and map pin. Without it, names like "Hotel Romazzino" vs Google's "Romazzino, A Belmond
      // Hotel" are too different to match later.
      const placeId = rec.placeId ?? await loadPickInfo(rec).then(info => info.placeId, () => null)
      if (placeId) form.set('placeId', placeId)
      const result = await addPlanPlace(tripId.current, form)
      if (result.error) throw new Error(result.error)
      setAdded(current => new Set(current).add(rec.key))
      if (created) router.replace(`/testplan?trip=${tripId.current}`, { scroll: false })
      else router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add this place.') }
    finally { setAdding(null) }
  }

  return <div className={`mx-auto grid max-w-7xl gap-4 px-4 pt-4 text-[#2e4147] lg:h-[calc(100dvh-4.5rem-var(--app-bottom-clearance))] ${mapView === 'hidden' ? 'lg:grid-cols-1' : mapView === 'small' ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'}`}>
    <div className="flex min-h-0 flex-col gap-4">
      <section aria-label="New trip" className={`min-h-0 overflow-y-auto rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4 ${places.length ? 'lg:flex-1' : 'lg:flex-none'}`}>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#59694f]"><Sparkles size={14} />Plan with Postcard</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl">{trip?.title ?? 'Your next trip'}</h1>
          <div className="flex items-center gap-4 text-sm font-semibold text-[#59694f]">
            {trip && <Link href={`/plan/${trip.id}`}>Open in planner →</Link>}
            {mapView === 'hidden' && <button type="button" onClick={() => setMapView('normal')} className="inline-flex items-center gap-1"><MapIcon size={14} />Show map</button>}
            {turns.length > 0 && <button type="button" disabled={thinking} onClick={() => { chatId.current = ''; tripId.current = ''; setTurns([]); setAdded(new Set()); setError(''); router.push('/testplan?new=1') }} className="inline-flex items-center gap-1 disabled:opacity-50"><SquarePen size={14} />New chat</button>}
          </div>
        </div>
        {!places.length ? <p className="mt-3 text-sm text-[#73786d]">Ask Postcard where to go. Places you add from its suggestions will build your itinerary here.</p>
          : categories.map(category => { const items = places.filter(place => place.type === category.value); return items.length > 0 && <section key={category.value} className="mt-5"><div className={`${styles.categoryHeading} ${styles[category.value]}`}><h3><span className={styles.categoryIcon}><category.Icon size={17} /></span>{category.label}</h3><span className={styles.count}>{items.length} {items.length === 1 ? 'place' : 'places'}</span></div><div className="space-y-3">{items.map(place => <article key={place.id} className={`${planningStyles.place} ${styles[category.value]}`}><div className={`${styles.card} ${planningStyles.card}`}>
            <PlacePhoto itemId={place.id} name={place.name} photos={place.photos} thumbnailClass={styles.thumbnail} fallback={<div className={styles.keepsake} aria-hidden="true"><span>{category.eyebrow}</span><category.Icon size={25} strokeWidth={1} /><span>{place.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span></div>} />
            <div className={styles.cardBody}><p className={styles.eyebrow}>{category.eyebrow}{place.day !== null && ` · Day ${place.day}`}</p><h3 className={styles.placeName}>{place.name}</h3><p className={planningStyles.location}>{place.destination}</p>{place.notes && <p className={styles.note}>{place.notes}</p>}</div>
          </div></article>)}</div></section> })}
      </section>

      <section aria-label="Chat with Postcard" className="flex min-h-0 flex-col rounded-2xl border border-[#d7cebc] bg-[#fffdf7] lg:h-auto lg:flex-[1.2]">
        <div ref={scroller} className="min-h-0 flex-1 space-y-4 p-4 lg:overflow-y-auto" aria-live="polite">
          {!turns.length && !skippedSetup && <TripSetup hasOwnTrips={hasOwnTrips} initial={lastPreferences} disabled={thinking} onSubmit={preferences => void send('Show me trip ideas that fit what I picked.', preferences)} onSkip={() => setSkippedSetup(true)} />}
          {!turns.length && skippedSetup && <div className="text-sm text-[#73786d]"><p>Postcard uses your trips and your friends’ trips—their ratings and notes—plus its own picks. Try:</p><div className="mt-3 flex flex-wrap gap-2">{starters.map(starter => <button key={starter} type="button" onClick={() => void send(starter)} className="rounded-full border border-[#d7cebc] px-3 py-1.5 text-left text-xs text-[#59694f] hover:bg-[#f3eee5]">{starter}</button>)}</div></div>}
          {turns.map((turn, index) => turn.role === 'preferences'
            ? <PreferencesSummary key={index} preferences={turn.preferences} />
            : turn.role === 'user'
            ? <p key={index} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[#355650] px-4 py-2 text-sm text-white">{turn.text}</p>
            : <div key={index} className="space-y-3"><p className="max-w-[92%] whitespace-pre-wrap text-sm leading-relaxed">{turn.text}</p>
              {groupByOption(turn.recommendations).map(([option, recs]) => <section key={option} aria-label={option} className="rounded-xl border-l-4 bg-[#faf7f1] py-3 pl-3 pr-2" style={{ borderColor: colorOf(recs[0]) }}>
                <h3 className="font-[family-name:var(--font-playfair)] text-lg leading-tight" style={{ color: colorOf(recs[0]) }}>{option}</h3>
                <p className="text-xs text-[#73786d]">{[...new Set(recs.map(rec => [rec.destination, rec.country].filter(Boolean).join(', ')))].join(' · ')}</p>
                {sectionOrder.map(({ type, label, Icon }) => { const items = recs.filter(rec => rec.type === type); return items.length > 0 && <div key={type} className="mt-3">
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#59694f]"><Icon size={13} />{label}</h4>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-2">{items.map(rec => <RecommendationCard key={rec.key} rec={rec} color={colorOf(rec)} grouped added={inTrip(rec)} busy={adding === rec.key} disabled={adding !== null} onAdd={() => void add(rec)} />)}</div>
                </div> })}
              </section>)}
            </div>)}
          {thinking && <p className="text-sm text-[#73786d]">Postcard is looking through your trips…</p>}
        </div>
        {error && <p role="alert" className="px-4 pb-2 text-sm text-red-700">{error}</p>}
        <div ref={endOfChat} aria-hidden="true" style={{ scrollMarginBottom: 'calc(var(--app-bottom-clearance) + 4.5rem)' }} />
        {/* On phones the composer sticks just above the bottom navigation so it is always reachable. */}
        <form className="sticky bottom-[calc(var(--app-bottom-clearance)-2.1rem)] z-10 flex items-end gap-2 rounded-b-2xl border-t border-[#e6dfd1] bg-[#fffdf7] p-3 lg:static" onSubmit={event => { event.preventDefault(); void send(draft) }}>
          <textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft) } }} rows={1} maxLength={4000} placeholder="Ask about a place or a trip…" aria-label="Message Postcard" className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[#d7cebc] bg-white px-3 py-2.5 text-base lg:text-sm outline-none focus:border-[#59694f]" />
          <button type="submit" disabled={thinking || !draft.trim()} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#355650] text-white disabled:opacity-40"><ArrowUp size={18} /></button>
        </form>
      </section>
    </div>

    {mapView === 'hidden' ? null
    : <section aria-label="Map" className={`relative isolate order-first overflow-hidden rounded-2xl border border-[#d7cebc] bg-[#fffdf7] lg:order-none lg:h-auto ${mapView === 'small' ? 'h-[22dvh]' : 'h-[32dvh]'}`}>
      <div className="absolute right-3 top-3 z-[1000] flex gap-1.5">
        <button type="button" onClick={() => setMapView(mapView === 'small' ? 'normal' : 'small')} aria-label={mapView === 'small' ? 'Restore map size' : 'Shrink map'} title={mapView === 'small' ? 'Restore map size' : 'Shrink map'} className="flex size-9 items-center justify-center rounded-lg border border-[#d7cebc] bg-[#fffdf7]/95 text-[#355650] shadow-sm hover:bg-white">{mapView === 'small' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}</button>
        <button type="button" onClick={() => setMapView('hidden')} aria-label="Hide map" title="Hide map" className="flex size-9 items-center justify-center rounded-lg border border-[#d7cebc] bg-[#fffdf7]/95 text-[#355650] shadow-sm hover:bg-white"><EyeOff size={16} /></button>
      </div>
      <TripMap places={mapPlaces} />
      {legend.length > 0 && <div aria-label="Trip ideas on the map" className="absolute bottom-3 left-3 z-[1000] max-w-[70%] space-y-1 rounded-xl bg-[#fffdf7]/95 px-3 py-2 text-xs shadow-md">
        {legend.map(option => <p key={option} className="flex items-center gap-2"><span aria-hidden="true" className="size-3 shrink-0 rounded-full border-2 border-white shadow" style={{ background: optionColors[options.indexOf(option) % optionColors.length] }} /><span className="truncate">{option}</span></p>)}
      </div>}
    </section>}
  </div>
}

function RecommendationCard({ rec, color, grouped = false, added, busy, disabled, onAdd }: { rec: Recommendation; color: string; grouped?: boolean; added: boolean; busy: boolean; disabled: boolean; onAdd: () => void }) {
  const category = categories.find(category => category.value === rec.type) ?? categories[2]
  const [open, setOpen] = useState(false)
  const addButton = <button type="button" onClick={onAdd} disabled={added || disabled} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#8caaa3] bg-white px-3 text-xs font-semibold text-[#355650] disabled:opacity-60">{added ? <><Check size={14} />Added</> : busy ? 'Adding…' : <><Plus size={14} />Add to trip</>}</button>
  return <article className="flex flex-col rounded-xl border border-[#e6dfd1] bg-white p-3 transition-shadow hover:shadow-md">
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`View details for ${rec.name}`} className="flex flex-1 flex-col text-left">
      {/* In a grouped reply the idea and category are already in the headings above. */}
      {!grouped && <p className="mb-1 flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#73786d]"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} /><span className="min-w-0 truncate" style={{ color }}>{optionOf(rec)}</span><span aria-hidden="true">·</span><category.Icon size={12} className="shrink-0" />{category.eyebrow}</p>}
      <h3 className="font-semibold leading-snug">{rec.name}</h3>
      <p className="text-xs text-[#73786d]">{[rec.destination, rec.country].filter(Boolean).join(', ')}</p>
      <p className="mt-2 flex-1 text-sm">{rec.why}</p>
      <span className="mt-2 text-xs font-semibold text-[#59694f]">{rec.source === 'claude' ? 'Photos & details →' : rec.source === 'you' ? 'Your notes & photos →' : `${rec.friendName}’s notes & photos →`}</span>
    </button>
    <div className="mt-3 flex items-center justify-between gap-2">
      <SourceBadge rec={rec} />
      {addButton}
    </div>
    {open && <PickDetails rec={rec} color={color} addButton={addButton} onClose={() => setOpen(false)} />}
  </article>
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="mt-4"><legend className="mb-2 text-sm font-semibold text-[#2e4147]">{title}</legend><div className="flex flex-wrap gap-2">{children}</div></fieldset>
}

// Asked before the first recommendation. What the trip is now is always asked; budget, destination
// types and activities only when there are no past trips to learn them from.
function TripSetup({ hasOwnTrips, initial, disabled, onSubmit, onSkip }: { hasOwnTrips: boolean; initial: TravelPreferences | null; disabled: boolean; onSubmit: (preferences: TravelPreferences) => void; onSkip: () => void }) {
  const [travelers, setTravelers] = useState(initial?.travelers ?? '')
  const [length, setLength] = useState(initial?.length ?? '')
  const [budget, setBudget] = useState<number | null>(initial?.budget ?? null)
  const [destinationTypes, setDestinationTypes] = useState<string[]>(initial?.destinationTypes ?? [])
  const [activities, setActivities] = useState<string[]>(initial?.activities ?? [])
  const askTaste = !hasOwnTrips
  const ready = !!travelers && !!length && (!askTaste || (!!budget && destinationTypes.length > 0 && activities.length > 0))
  const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(item => item !== value) : [...list, value]
  const chip = (selected: boolean) => `min-h-10 rounded-full border px-3 text-sm ${selected ? 'border-[#59694f] bg-[#e6ece5] font-semibold text-[#2e4147]' : 'border-[#d7cebc] text-[#59694f] hover:bg-[#f3eee5]'}`
  return <section aria-label="Tell us about this trip" className="rounded-xl bg-[#faf7f1] p-4">
    <h2 className="font-[family-name:var(--font-playfair)] text-xl">Tell us about this trip</h2>
    <p className="mt-1 text-sm text-[#73786d]">{askTaste ? 'A few quick picks so the ideas actually fit you.' : 'We’ll use your past trips for your budget and taste—just tell us about this one.'}</p>
    <Group title="Who’s going?">{TRAVELERS.map(option => <button key={option} type="button" aria-pressed={travelers === option} onClick={() => setTravelers(option)} className={chip(travelers === option)}>{option}</button>)}</Group>
    <Group title="How long?">{TRIP_LENGTHS.map(option => <button key={option} type="button" aria-pressed={length === option} onClick={() => setLength(option)} className={chip(length === option)}>{option}</button>)}</Group>
    {askTaste && <>
      <Group title="Budget">{BUDGETS.map(option => <button key={option.value} type="button" aria-pressed={budget === option.value} onClick={() => setBudget(option.value)} className={chip(budget === option.value)}>{option.label} <span className="font-normal text-[#73786d]">{option.hint}</span></button>)}</Group>
      <Group title="Types of destination (pick any)">{DESTINATION_TYPES.map(option => <button key={option} type="button" aria-pressed={destinationTypes.includes(option)} onClick={() => setDestinationTypes(list => toggle(list, option))} className={chip(destinationTypes.includes(option))}>{option}</button>)}</Group>
      <Group title="Things you like to do (pick any)">{ACTIVITIES.map(option => <button key={option} type="button" aria-pressed={activities.includes(option)} onClick={() => setActivities(list => toggle(list, option))} className={chip(activities.includes(option))}>{option}</button>)}</Group>
    </>}
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="button" disabled={!ready || disabled} onClick={() => onSubmit({ travelers, length, budget: askTaste ? budget : null, destinationTypes: askTaste ? destinationTypes : [], activities: askTaste ? activities : [] })} className="min-h-11 rounded-xl bg-[#355650] px-5 text-sm font-semibold text-white disabled:opacity-40">Show me ideas →</button>
      <button type="button" onClick={onSkip} className="min-h-11 text-sm text-[#59694f] underline">Skip, I’ll just ask</button>
    </div>
  </section>
}

function PreferencesSummary({ preferences }: { preferences: TravelPreferences }) {
  const budget = BUDGETS.find(option => option.value === preferences.budget)
  const parts = [preferences.travelers, preferences.length, budget?.label, preferences.destinationTypes.join(', '), preferences.activities.join(', ')].filter(Boolean)
  return <p className="ml-auto w-fit max-w-[85%] rounded-2xl border border-[#c7d7cf] bg-[#edf1e9] px-4 py-2 text-xs text-[#355650]"><span className="font-semibold">This trip:</span> {parts.join(' · ')}</p>
}

function SourceBadge({ rec }: { rec: Recommendation }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${rec.source === 'claude' ? 'bg-[#eef0f6] text-[#465e7a]' : 'bg-[#edf1e9] text-[#59694f]'}`}>{rec.source === 'claude' ? <><Sparkles size={11} />Postcard’s pick</> : rec.source === 'you' ? <><MapPin size={11} />Your past trip</> : <><Users size={11} />{rec.friendName}</>}</span>
}

type PickInfo = { author: string | null; notes: string | null; rating: number | null; description: string | null; googleRating?: { value: number; count: number } | null; photos: { url: string; credit: string | null }[]; photosFromGoogle: boolean; address: string | null; website: string | null; placeId: string | null; trip: { title: string; href: string } | null }
// Details are fetched once per place per page load; Google lookups are slow and billed.
const pickInfoCache = new Map<string, Promise<PickInfo>>()
function loadPickInfo(rec: Recommendation) {
  const key = rec.sourceItemId ? `item:${rec.sourceItemId}` : `web:${rec.name}|${[rec.destination, rec.country].filter(Boolean).join(', ')}`
  if (!pickInfoCache.has(key)) {
    const query = rec.sourceItemId ? `item=${encodeURIComponent(rec.sourceItemId)}` : `name=${encodeURIComponent(rec.name)}&city=${encodeURIComponent(rec.destination)}&country=${encodeURIComponent(rec.country ?? '')}`
    const request = fetch(`/api/testplan/place?${query}`).then(response => response.ok ? response.json() as Promise<PickInfo> : Promise.reject(new Error()))
    request.catch(() => pickInfoCache.delete(key))
    pickInfoCache.set(key, request)
  }
  return pickInfoCache.get(key)!
}

// Pop-out in the same style as the place cards on trip pages: the friend's own notes and photos
// when the pick came from a trip, otherwise Claude's description with photos from Google.
function PickDetails({ rec, color, addButton, onClose }: { rec: Recommendation; color: string; addButton: React.ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [info, setInfo] = useState<PickInfo | null>(null)
  const [failed, setFailed] = useState(false)
  const category = categories.find(category => category.value === rec.type) ?? categories[2]
  const city = [rec.destination, rec.country].filter(Boolean).join(', ')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let active = true
    loadPickInfo(rec).then(data => { if (active) setInfo(data) }, () => { if (active) setFailed(true) })
    return () => { active = false; element?.close(); document.body.style.overflow = previous }
  }, [rec])

  const mapUrl = new URL('https://www.google.com/maps/search/')
  mapUrl.searchParams.set('api', '1')
  mapUrl.searchParams.set('query', rec.lat != null && rec.lng != null ? `${rec.lat},${rec.lng}` : [rec.name, info?.address ?? city].join(', '))
  const placeId = rec.placeId ?? info?.placeId
  if (placeId) mapUrl.searchParams.set('query_place_id', placeId)
  const website = info?.website && /^https?:\/\//i.test(info.website) ? info.website : null
  const who = rec.source === 'you' ? 'Your' : `${rec.friendName}’s`

  return <dialog ref={dialog} className={detailStyles.dialog} aria-labelledby={titleId} onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
    <div className={detailStyles.content}>
      <header className={detailStyles.header}>
        <div>
          <p className={detailStyles.category}>{category.eyebrow} · {city}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><SourceBadge rec={rec} /><span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color }}><span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />{optionOf(rec)}</span></p>
          <h2 id={titleId} className={detailStyles.title}>{rec.name}</h2>
        </div>
        <button type="button" autoFocus className={detailStyles.close} aria-label="Close place details" onClick={() => dialog.current?.close()}><X size={22} /></button>
      </header>

      {rec.source !== 'claude' && <section>
        <h3 className={detailStyles.sectionTitle}>{who} notes{info?.rating ? <span className="ml-2 font-normal text-[#a27e3b]">{'★'.repeat(info.rating)}{'☆'.repeat(5 - info.rating)}</span> : null}</h3>
        {!info && !failed ? <p className={detailStyles.muted}>Loading…</p> : info?.notes ? <p className={detailStyles.text}>{info.notes}</p> : <p className={detailStyles.muted}>{rec.source === 'you' ? 'You didn’t add notes for this place.' : `${rec.friendName} didn’t add notes for this place.`}</p>}
        {info?.trip && <Link href={info.trip.href} className="mt-2 inline-block text-sm font-semibold text-[#59694f]">From {rec.source === 'you' ? 'your' : `${rec.friendName}’s`} trip “{info.trip.title}” →</Link>}
      </section>}

      {!info && !failed ? <div className="h-56 animate-pulse rounded-lg bg-[#ece5d8]" aria-hidden="true" />
        : info && info.photos.length > 0 && <section>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-lg">{info.photos.map(photo => <figure key={photo.url} className="relative h-56 w-[85%] shrink-0 snap-center overflow-hidden rounded-lg bg-[#ece5d8] sm:w-[70%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            {photo.credit && <figcaption className="absolute bottom-1 right-2 rounded bg-black/50 px-1.5 text-[10px] text-white">{photo.credit}</figcaption>}
          </figure>)}</div>
          {info.photosFromGoogle && <p className="mt-1 text-[11px] text-[#73786d]">Photos from Google{rec.source !== 'claude' ? ` · ${rec.source === 'you' ? 'you' : rec.friendName} didn’t add any` : ''}</p>}
        </section>}

      <section><h3 className={detailStyles.sectionTitle}>Why Postcard suggested it</h3><p className={detailStyles.text}>{rec.why}</p></section>
      {(rec.description || info?.description) && <section><h3 className={detailStyles.sectionTitle}>About</h3>
        {rec.description && <p className={detailStyles.text}>{rec.description}</p>}
        {info?.description && info.description !== rec.description && <p className={`${detailStyles.text} ${rec.description ? 'mt-2 text-[#73786d]' : ''}`}>{info.description}</p>}
        {info?.googleRating && <p className="mt-2 text-sm text-[#73786d]">★ {info.googleRating.value.toFixed(1)} on Google · {info.googleRating.count.toLocaleString()} reviews</p>}
      </section>}
      {info?.address && <section><h3 className={detailStyles.sectionTitle}>Address</h3><p className={detailStyles.address}><MapPin size={17} />{info.address}</p></section>}
      {failed && <p className={detailStyles.muted}>Couldn’t load photos and details right now.</p>}

      <div className={detailStyles.actions}>
        <a href={mapUrl.toString()} target="_blank" rel="noopener noreferrer" className={detailStyles.mapLink}><MapPin size={17} />View on map<span className="sr-only"> (opens Google Maps in a new tab)</span></a>
        {website && <a href={website} target="_blank" rel="noopener noreferrer" className={detailStyles.website}>Official website<ArrowUpRight size={16} /><span className="sr-only"> (opens in a new tab)</span></a>}
        {addButton}
      </div>
    </div>
  </dialog>
}

// Same lookup strategy as PlanningMap, sized to fill its panel.
function TripMap({ places }: { places: MapPlace[] }) {
  const cache = useRef(new Map<string, { lat: number; lng: number } | null>())
  const [locations, setLocations] = useState<Record<string, { lat: number; lng: number } | null>>({})
  const lookupKeys = JSON.stringify([...new Set(places.filter(place => !validMapLocation(place)).map(tripMapLookupKey))].sort())
  useEffect(() => {
    const controller = new AbortController()
    const keys: string[] = JSON.parse(lookupKeys)
    async function worker() {
      while (keys.length && !controller.signal.aborted) {
        const key = keys.shift()!
        if (cache.current.has(key)) continue
        try {
          const response = await fetch(key.startsWith('id:') ? `/api/place-details?id=${encodeURIComponent(key.slice(3))}` : `/api/trip-map-location?q=${encodeURIComponent(key.slice(2))}`, { signal: controller.signal })
          const data = response.ok ? await response.json() : null
          if (controller.signal.aborted) return
          const location = validMapLocation(data) ? { lat: data.lat, lng: data.lng } : null
          cache.current.set(key, location)
          setLocations(previous => ({ ...previous, [key]: location }))
        } catch { if (controller.signal.aborted) return; cache.current.set(key, null) }
      }
    }
    void Promise.all([worker(), worker(), worker()])
    return () => controller.abort()
  }, [lookupKeys])
  const pins: ItemPin[] = places.flatMap(place => {
    const location = validMapLocation(place) ? { lat: place.lat, lng: place.lng } : locations[tripMapLookupKey(place)]
    return location ? [{ id: place.id, name: place.name, type: place.type, day: place.day, recommendation: 'none' as const, color: place.color, label: place.label, ...location }] : []
  })
  return pins.length ? <ItineraryMap pins={pins} /> : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[#73786d]">{places.length ? 'Finding places on the map…' : 'Suggestions and the places in your trip will appear here.'}</div>
}
