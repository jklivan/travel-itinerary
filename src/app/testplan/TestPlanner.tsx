'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Camera, Check, Hotel, Plane, Plus, Sparkles, Users, Utensils, MapPin, SquarePen } from 'lucide-react'
import styles from '../itinerary/[id]/places.module.css'
import planningStyles from '../plan/[id]/Planner.module.css'
import ItineraryMap from '@/components/ItineraryMap'
import type { ItemPin } from '@/components/ItineraryMapInner'
import PlacePhoto from '@/components/PlacePhoto'
import { addPlanPlace, startPlan } from '@/actions/planning'
import { linkPlanChat } from '@/actions/planChat'
import { tripMapLookupKey, validMapLocation, type TripMapPlace } from '@/lib/tripMapPlaces'

type Place = { id: string; name: string; type: string; notes: string | null; placeId: string | null; lat: number | null; lng: number | null; day: number | null; photos: string[]; destination: string }
type Trip = { id: string; title: string; places: Place[] }
type Recommendation = { key: string; name: string; type: 'hotel' | 'food_drink' | 'activity'; why: string; destination: string; country: string | null; source: 'friend' | 'you' | 'claude'; friendName: string; sourceItemId: string; placeId: string | null; lat: number | null; lng: number | null }
export type Turn = { role: 'user'; text: string } | { role: 'assistant'; text: string; recommendations: Recommendation[] }
type MapPlace = TripMapPlace & { lat: number | null; lng: number | null }

const categories = [{ value: 'hotel', label: 'Hotels', eyebrow: 'Stay', Icon: Hotel }, { value: 'food_drink', label: 'Restaurants', eyebrow: 'Food & drink', Icon: Utensils }, { value: 'activity', label: 'Activities', eyebrow: 'Explore', Icon: Camera }, { value: 'transport', label: 'Transportation', eyebrow: 'Getting around', Icon: Plane }]
const starters = ['Where should I go for a long weekend?', 'What did my friends love most?', 'Plan 3 days in a city my friends rated highly']

export default function TestPlanner({ trip, chat }: { trip: Trip | null; chat: { id: string; turns: Turn[] } | null }) {
  const router = useRouter()
  const [turns, setTurns] = useState<Turn[]>(chat?.turns ?? [])
  const chatId = useRef(chat?.id ?? '')
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  const tripId = useRef(trip?.id ?? '')
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [turns, thinking])

  const latest = [...turns].reverse().find(turn => turn.role === 'assistant' && turn.recommendations.length) as Extract<Turn, { role: 'assistant' }> | undefined
  const places = trip?.places ?? []
  const inTrip = (rec: Recommendation) => added.has(rec.key) || places.some(place => place.name.trim().toLowerCase() === rec.name.trim().toLowerCase())
  const suggestions = (latest?.recommendations ?? []).filter(rec => !inTrip(rec))
  const mapPlaces: MapPlace[] = [
    ...places.filter(place => place.type !== 'transport' || place.placeId || validMapLocation(place)).map(place => ({ id: place.id, name: place.name, city: place.destination, type: place.type as MapPlace['type'], day: place.day, placeId: place.placeId ?? undefined, lat: place.lat, lng: place.lng })),
    ...suggestions.map(rec => ({ id: rec.key, name: `Suggested: ${rec.name}`, city: [rec.destination, rec.country].filter(Boolean).join(', '), type: rec.type, day: null, placeId: rec.placeId ?? undefined, lat: rec.lat, lng: rec.lng })),
  ]

  async function send(text: string) {
    const message = text.trim()
    if (!message || thinking) return
    setThinking(true); setError(''); setDraft('')
    setTurns(current => [...current, { role: 'user', text: message }])
    try {
      const response = await fetch('/api/testplan/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: chatId.current, message, tripId: tripId.current }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Something went wrong.')
      chatId.current = data.chatId
      setTurns(current => [...current, { role: 'assistant', text: data.reply, recommendations: data.recommendations }])
    } catch (caught) {
      setTurns(current => current.slice(0, -1)); setDraft(message)
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
      if (rec.placeId) form.set('placeId', rec.placeId)
      const result = await addPlanPlace(tripId.current, form)
      if (result.error) throw new Error(result.error)
      setAdded(current => new Set(current).add(rec.key))
      if (created) router.replace(`/testplan?trip=${tripId.current}`, { scroll: false })
      else router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add this place.') }
    finally { setAdding(null) }
  }

  return <div className="mx-auto grid max-w-7xl gap-4 px-4 pt-4 text-[#2e4147] lg:h-[calc(100dvh-4.5rem-var(--app-bottom-clearance))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <div className="flex min-h-0 flex-col gap-4">
      <section aria-label="New trip" className="min-h-0 overflow-y-auto rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4 lg:flex-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#59694f]"><Sparkles size={14} />Plan with Claude · test</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl">{trip?.title ?? 'Your next trip'}</h1>
          <div className="flex items-center gap-4 text-sm font-semibold text-[#59694f]">
            {trip && <Link href={`/plan/${trip.id}`}>Open in planner →</Link>}
            {turns.length > 0 && <button type="button" disabled={thinking} onClick={() => { chatId.current = ''; tripId.current = ''; setTurns([]); setAdded(new Set()); setError(''); router.push('/testplan?new=1') }} className="inline-flex items-center gap-1 disabled:opacity-50"><SquarePen size={14} />New chat</button>}
          </div>
        </div>
        {!places.length ? <p className="mt-3 text-sm text-[#73786d]">Ask Claude where to go. Places you add from its suggestions will build your itinerary here.</p>
          : categories.map(category => { const items = places.filter(place => place.type === category.value); return items.length > 0 && <section key={category.value} className="mt-5"><div className={`${styles.categoryHeading} ${styles[category.value]}`}><h3><span className={styles.categoryIcon}><category.Icon size={17} /></span>{category.label}</h3><span className={styles.count}>{items.length} {items.length === 1 ? 'place' : 'places'}</span></div><div className="space-y-3">{items.map(place => <article key={place.id} className={`${planningStyles.place} ${styles[category.value]}`}><div className={`${styles.card} ${planningStyles.card}`}>
            <PlacePhoto itemId={place.id} name={place.name} photos={place.photos} thumbnailClass={styles.thumbnail} fallback={<div className={styles.keepsake} aria-hidden="true"><span>{category.eyebrow}</span><category.Icon size={25} strokeWidth={1} /><span>{place.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span></div>} />
            <div className={styles.cardBody}><p className={styles.eyebrow}>{category.eyebrow}{place.day !== null && ` · Day ${place.day}`}</p><h3 className={styles.placeName}>{place.name}</h3><p className={planningStyles.location}>{place.destination}</p>{place.notes && <p className={styles.note}>{place.notes}</p>}</div>
          </div></article>)}</div></section> })}
      </section>

      <section aria-label="Chat with Claude" className="flex h-[70dvh] min-h-0 flex-col rounded-2xl border border-[#d7cebc] bg-[#fffdf7] lg:h-auto lg:flex-[1.2]">
        <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {!turns.length && <div className="text-sm text-[#73786d]"><p>Claude can see your trips and your friends’ trips—their ratings and notes. Try:</p><div className="mt-3 flex flex-wrap gap-2">{starters.map(starter => <button key={starter} type="button" onClick={() => void send(starter)} className="rounded-full border border-[#d7cebc] px-3 py-1.5 text-left text-xs text-[#59694f] hover:bg-[#f3eee5]">{starter}</button>)}</div></div>}
          {turns.map((turn, index) => turn.role === 'user'
            ? <p key={index} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[#355650] px-4 py-2 text-sm text-white">{turn.text}</p>
            : <div key={index} className="space-y-3"><p className="max-w-[92%] whitespace-pre-wrap text-sm leading-relaxed">{turn.text}</p>
              {turn.recommendations.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{turn.recommendations.map(rec => <RecommendationCard key={rec.key} rec={rec} added={inTrip(rec)} busy={adding === rec.key} disabled={adding !== null} onAdd={() => void add(rec)} />)}</div>}
            </div>)}
          {thinking && <p className="text-sm text-[#73786d]">Claude is looking through your trips…</p>}
        </div>
        {error && <p role="alert" className="px-4 pb-2 text-sm text-red-700">{error}</p>}
        <form className="flex items-end gap-2 border-t border-[#e6dfd1] p-3" onSubmit={event => { event.preventDefault(); void send(draft) }}>
          <textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft) } }} rows={1} maxLength={4000} placeholder="Where should I go? What did friends love in Lisbon?" aria-label="Message Claude" className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[#d7cebc] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#59694f]" />
          <button type="submit" disabled={thinking || !draft.trim()} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#355650] text-white disabled:opacity-40"><ArrowUp size={18} /></button>
        </form>
      </section>
    </div>

    <section aria-label="Map" className="relative isolate order-first h-[40dvh] overflow-hidden rounded-2xl border border-[#d7cebc] bg-[#fffdf7] lg:order-none lg:h-auto">
      <TripMap places={mapPlaces} />
    </section>
  </div>
}

function RecommendationCard({ rec, added, busy, disabled, onAdd }: { rec: Recommendation; added: boolean; busy: boolean; disabled: boolean; onAdd: () => void }) {
  const category = categories.find(category => category.value === rec.type) ?? categories[2]
  return <article className="flex flex-col rounded-xl border border-[#e6dfd1] bg-white p-3">
    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#73786d]"><category.Icon size={12} />{category.eyebrow}</p>
    <h3 className="mt-1 font-semibold leading-snug">{rec.name}</h3>
    <p className="text-xs text-[#73786d]">{[rec.destination, rec.country].filter(Boolean).join(', ')}</p>
    <p className="mt-2 flex-1 text-sm">{rec.why}</p>
    <div className="mt-3 flex items-center justify-between gap-2">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${rec.source === 'claude' ? 'bg-[#eef0f6] text-[#465e7a]' : 'bg-[#edf1e9] text-[#59694f]'}`}>{rec.source === 'claude' ? <><Sparkles size={11} />Claude’s pick</> : rec.source === 'you' ? <><MapPin size={11} />Your past trip</> : <><Users size={11} />{rec.friendName}</>}</span>
      <button type="button" onClick={onAdd} disabled={added || disabled} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#8caaa3] px-3 text-xs font-semibold text-[#355650] disabled:opacity-60">{added ? <><Check size={14} />Added</> : busy ? 'Adding…' : <><Plus size={14} />Add to trip</>}</button>
    </div>
  </article>
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
    return location ? [{ id: place.id, name: place.name, type: place.type, day: place.day, recommendation: 'none' as const, ...location }] : []
  })
  return pins.length ? <ItineraryMap pins={pins} /> : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[#73786d]">{places.length ? 'Finding places on the map…' : 'Suggestions and the places in your trip will appear here.'}</div>
}
