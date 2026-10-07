'use client'

import Link from 'next/link'
import RatingStars from '@/components/RatingStars'
import { useEffect, useId, useRef, useState } from 'react'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowUpRight, Camera, Check, ChevronRight, EyeOff, History, Hotel, Map as MapIcon, Maximize2, Minimize2, Plane, Plus, Sparkles, Users, Utensils, MapPin, SquarePen, X } from 'lucide-react'
import styles from '../itinerary/[id]/places.module.css'
import planningStyles from '../plan/[id]/Planner.module.css'
import detailStyles from '@/components/PlaceDetailsCard.module.css'
import ItineraryMap from '@/components/ItineraryMap'
import type { ItemPin } from '@/components/ItineraryMapInner'
import PlacePhoto from '@/components/PlacePhoto'
import { addPlanPlace, startPlan } from '@/actions/planning'
import { linkPlanChat } from '@/actions/planChat'
import { tripMapLookupKey, validMapLocation, type TripMapPlace } from '@/lib/tripMapPlaces'
import { ACTIVITIES, BUDGETS, DESTINATION_TYPES, SETUP_MESSAGE, TRAVELERS, TRIP_LENGTHS, type TravelPreferences } from '@/lib/travelPreferences'

type Place = { id: string; name: string; type: string; notes: string | null; placeId: string | null; lat: number | null; lng: number | null; day: number | null; photos: string[]; destination: string }
type Trip = { id: string; title: string; places: Place[] }
type Recommendation = { key: string; name: string; type: 'hotel' | 'food_drink' | 'activity'; why: string; price?: string; destination: string; country: string | null; tripOption?: string; description?: string; source: 'friend' | 'you' | 'claude'; friendName: string; sourceItemId: string; placeId: string | null; lat: number | null; lng: number | null }
export type Turn = { role: 'user'; text: string } | { role: 'assistant'; text: string; recommendations: Recommendation[]; title?: string; summary?: string } | { role: 'preferences'; preferences: TravelPreferences }
type MapPlace = TripMapPlace & { lat: number | null; lng: number | null; color?: string; label?: string }

const categories = [{ value: 'hotel', label: 'Hotels', eyebrow: 'Stay', Icon: Hotel }, { value: 'food_drink', label: 'Restaurants', eyebrow: 'Food & drink', Icon: Utensils }, { value: 'activity', label: 'Activities', eyebrow: 'Explore', Icon: Camera }, { value: 'transport', label: 'Transportation', eyebrow: 'Getting around', Icon: Plane }]
// One color per trip idea Claude suggests, chosen to stay distinct from the day colors used for the trip itself.
const optionColors = ['#c2410c', '#1d4ed8', '#7e22ce', '#0f766e', '#be185d', '#a16207', '#4d7c0f', '#b91c1c']
// Older saved chats have no tripOption, so fall back to grouping by country.
const optionOf = (rec: Recommendation) => rec.tripOption || rec.country || rec.destination

// Order within each suggested destination: where to stay, then what to do, then where to eat.
const sectionOrder = [{ type: 'hotel', label: 'Where to stay', Icon: Hotel }, { type: 'activity', label: 'Things to do', Icon: Camera }, { type: 'food_drink', label: 'Where to eat', Icon: Utensils }] as const
// The AI marks names with **bold**; show them bold instead of as asterisks.
function BoldText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong> : part)}</>
}

function groupByOption(recs: Recommendation[]) {
  const groups = new Map<string, Recommendation[]>()
  for (const rec of recs) groups.set(optionOf(rec), [...(groups.get(optionOf(rec)) ?? []), rec])
  return [...groups.entries()]
}

type PastChat = { id: string; topic: string; summary?: string; updatedAt: string }

const starters = ['Surprise me with a long weekend', 'Where should we go this spring?', 'Somewhere new my friends haven’t been']

export default function TestPlanner({ trip, chat, history, hasOwnTrips, lastPreferences, initialDraft = '', fromPlanner = false }: { fromPlanner?: boolean; initialDraft?: string; trip: Trip | null; chat: { id: string; turns: Turn[] } | null; history: PastChat[]; hasOwnTrips: boolean; lastPreferences: TravelPreferences | null }) {
  const router = useRouter()
  const [turns, setTurns] = useState<Turn[]>(chat?.turns ?? [])
  const chatId = useRef(chat?.id ?? '')
  const [draft, setDraft] = useState(initialDraft)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  // 'auto' until changed: the map shows on desktop and starts hidden on phones, behind "Show map". Phones
  // don't load it (or look up its places) until it's shown.
  const [mapView, setMapView] = useState<'auto' | 'normal' | 'small' | 'hidden'>('auto')
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => setWide(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  // Arriving with a question about a place skips the setup questions.
  const [skippedSetup, setSkippedSetup] = useState(!!initialDraft)
  // Phones: past chats stay behind the "Past chats" button, so a new chat is the first thing you see.
  const [showHistory, setShowHistory] = useState(false)
  const tripId = useRef(trip?.id ?? '')
  const scroller = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  // While typing on a phone, pin the message box just above the on-screen keyboard. Safari reports the visible
  // area (visualViewport); in the iPhone app that can lag or not change at all, so the app's keyboard plugin
  // also says how tall the keyboard is, and the box keeps clear of it either way.
  const form = useRef<HTMLFormElement>(null)
  const [pinnedTop, setPinnedTop] = useState<number | null>(null)
  useEffect(() => {
    const box = composer.current
    const viewport = window.visualViewport
    if (!box || !viewport) return
    let typing = false
    let keyboard = 0
    // The page's height with the keyboard closed, per screen width (portrait and landscape). Only ever grows:
    // the page can come back from the background still shrunk, and a too-small value put the box at the top.
    const fullHeights = new Map<number, number>()
    const fullHeight = () => {
      const height = Math.max(fullHeights.get(window.innerWidth) ?? 0, window.innerHeight)
      fullHeights.set(window.innerWidth, height)
      return height
    }
    fullHeight()
    function measure() {
      const full = fullHeight()
      if (!typing || !viewport) return
      if (window.matchMedia('(min-width: 1024px)').matches) { setPinnedTop(null); return }
      const height = form.current?.offsetHeight ?? 64
      // If the page already shrank for the keyboard, its visible bottom is the keyboard's top. Only when it didn't
      // (the keyboard slides over the page) does the keyboard's own height need taking off.
      const shrank = !keyboard || viewport.height < full - keyboard / 2
      const keyboardTop = shrank ? viewport.offsetTop + viewport.height : viewport.offsetTop + full - keyboard
      const top = keyboardTop - height - 8
      // A position up under the header means the numbers were off; leave the box where it normally sits.
      setPinnedTop(top > viewport.offsetTop + 80 ? top : null)
    }
    const later = () => { measure(); setTimeout(measure, 150); setTimeout(measure, 400) }
    function focus() { typing = true; later() }
    function blur() { typing = false; setPinnedTop(null) }
    box.addEventListener('focus', focus)
    box.addEventListener('blur', blur)
    box.addEventListener('input', measure)
    viewport.addEventListener('resize', measure)
    viewport.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    const listeners: Promise<PluginListenerHandle>[] = []
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Keyboard')) listeners.push(
      Keyboard.addListener('keyboardWillShow', info => { keyboard = info.keyboardHeight; later() }),
      Keyboard.addListener('keyboardDidShow', info => { keyboard = info.keyboardHeight; measure() }),
      Keyboard.addListener('keyboardWillHide', () => { keyboard = 0 }),
    )
    return () => {
      box.removeEventListener('focus', focus); box.removeEventListener('blur', blur); box.removeEventListener('input', measure)
      viewport.removeEventListener('resize', measure); viewport.removeEventListener('scroll', measure); window.removeEventListener('resize', measure)
      for (const listener of listeners) void listener.then(handle => handle.remove()).catch(() => {})
    }
  }, [])
  // The message box grows with what's typed (up to its max height), then scrolls.
  useEffect(() => {
    const box = composer.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${box.scrollHeight + 2}px`
  }, [draft])
  // Arriving with a question started: put the cursor at the end, ready to finish it.
  useEffect(() => {
    const box = composer.current
    if (box && initialDraft) box.setSelectionRange(box.value.length, box.value.length)
  }, [initialDraft])
  const endOfChat = useRef<HTMLDivElement>(null)
  const lastQuestion = useRef<HTMLParagraphElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    const box = scroller.current
    const question = lastQuestion.current
    // Opening a conversation shows its latest question and the reply, the part its title and summary
    // describe (earlier messages are above). After that, each new message scrolls into view.
    // Desktop: the messages scroll inside their panel. Phones: they flow with the page.
    if (firstRender.current) {
      if (question && box && box.scrollHeight > box.clientHeight) box.scrollTop += question.getBoundingClientRect().top - box.getBoundingClientRect().top - 16
      else question?.scrollIntoView({ behavior: 'auto', block: 'start' })
    } else if (!thinking && question && turns.at(-1)?.role === 'assistant') {
      // A reply arrived: show it from the top (your question, then the reply), not the end of its cards.
      if (box && box.scrollHeight > box.clientHeight) box.scrollTo({ top: box.scrollTop + question.getBoundingClientRect().top - box.getBoundingClientRect().top - 16, behavior: 'smooth' })
      else question.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (box && box.scrollHeight > box.clientHeight) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
    else endOfChat.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    firstRender.current = false
  }, [turns, thinking])

  const lastQuestionIndex = turns.findLastIndex(turn => turn.role === 'user')
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

  // Already on a blank chat (past chats listed above it on phones): close the list and go to the message box.
  function startNewChat() {
    if (!turns.length) { setShowHistory(false); requestAnimationFrame(() => { composer.current?.scrollIntoView({ block: 'center' }); composer.current?.focus() }); return }
    chatId.current = ''; tripId.current = ''; setTurns([]); setAdded(new Set()); setError(''); router.push('/testplan?new=1')
  }

  async function send(text: string, preferences?: TravelPreferences) {
    const message = text.trim()
    if (!message || thinking) return
    setThinking(true); setError(''); setDraft(''); setShowHistory(false)
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

  return <div className={`mx-auto grid max-w-[1440px] gap-4 px-4 pt-4 text-ink lg:h-[calc(100dvh-4.5rem-var(--app-bottom-clearance))] ${mapView === 'hidden' ? 'lg:grid-cols-[220px_minmax(0,1fr)]' : mapView === 'small' ? 'lg:grid-cols-[220px_minmax(0,1fr)_320px]' : 'lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.1fr)]'}`}>
    {/* Desktop: past conversations down the left. */}
    <aside aria-label="Past chats" className="panel hidden min-h-0 flex-col overflow-hidden lg:flex">
      <p className="flex items-center gap-2 border-b border-line-soft px-4 py-3 text-xs font-semibold uppercase tracking-wide text-link"><History size={14} />Past chats</p>
      {history.length ? <div className="min-h-0 overflow-y-auto p-2"><PastChats history={history} currentId={chat?.id} /></div> : <p className="p-4 text-sm text-muted">Your conversations will appear here.</p>}
    </aside>
    <div className="flex min-h-0 flex-col gap-4">
      <section aria-label="New trip" className={`min-h-0 overflow-y-auto rounded-2xl border border-line bg-card p-4 ${places.length ? 'lg:flex-1' : 'lg:flex-none'}`}>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-link"><Sparkles size={14} />Plan with Postcard</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="type-title">{trip?.title ?? 'Your next trip'}</h1>
          <div className="flex items-center gap-4 text-sm font-semibold text-link">
            {/* For a trip the chat built, a link to open it. From the planner, the header's Back returns there. */}
            {trip && !fromPlanner && <Link href={`/plan/${trip.id}`}>Open in planner →</Link>}
            {(mapView === 'hidden' || mapView === 'auto') && <button type="button" onClick={() => setMapView('normal')} className={`inline-flex items-center gap-1 ${mapView === 'auto' ? 'lg:hidden' : ''}`}><MapIcon size={14} />Show map</button>}
          </div>
        </div>
        {!places.length ? <p className="mt-3 text-sm text-muted">Ask Postcard where to go. Places you add from its suggestions will build your itinerary here.</p>
          : categories.map(category => { const items = places.filter(place => place.type === category.value); return items.length > 0 && <section key={category.value} className="mt-5"><div className={`${styles.categoryHeading} ${styles[category.value]}`}><h3><span className={styles.categoryIcon}><category.Icon size={17} /></span>{category.label}</h3><span className={styles.count}>{items.length} {items.length === 1 ? 'place' : 'places'}</span></div><div className="space-y-3">{items.map(place => <article key={place.id} className={`${planningStyles.place} ${styles[category.value]}`}><div className={`${styles.card} ${planningStyles.card}`}>
            <PlacePhoto itemId={place.id} name={place.name} photos={place.photos} thumbnailClass={styles.thumbnail} fallback={<div className={styles.keepsake} aria-hidden="true"><span>{category.eyebrow}</span><category.Icon size={25} strokeWidth={1} /><span>{place.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span></div>} />
            <div className={styles.cardBody}><p className={styles.eyebrow}>{category.eyebrow}{place.day !== null && ` · Day ${place.day}`}</p><h3 className={styles.placeName}>{place.name}</h3><p className={planningStyles.location}>{place.destination}</p>{place.notes && <p className={styles.note}>{place.notes}</p>}</div>
          </div></article>)}</div></section> })}
      </section>

      {/* Between the trip card and the chat: start over, or (on phones) open a past conversation. */}
      <div className="flex gap-2">
        <button type="button" disabled={thinking} onClick={startNewChat} className="btn btn-outline flex-1"><SquarePen size={16} />Start a new chat</button>
        {history.length > 0 && <button type="button" onClick={() => setShowHistory(value => !value)} aria-expanded={showHistory} aria-controls="past-chats-phone" className="btn btn-outline lg:hidden"><History size={16} />Past chats</button>}
      </div>
      {showHistory && history.length > 0 && <div id="past-chats-phone" className="panel p-2 lg:hidden"><p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-link">Past chats</p><PastChats history={history} currentId={chat?.id} limit={5} /></div>}

      <section aria-label="Chat with Postcard" className="panel flex min-h-0 flex-col lg:h-auto lg:flex-[1.2]">
        <div ref={scroller} className="min-h-0 flex-1 space-y-4 p-4 lg:overflow-y-auto" aria-live="polite">
          {!turns.length && !skippedSetup && <TripSetup hasOwnTrips={hasOwnTrips} initial={lastPreferences} disabled={thinking} onSubmit={preferences => void send(SETUP_MESSAGE, preferences)} onSkip={() => setSkippedSetup(true)} />}
          {!turns.length && skippedSetup && <div className="text-sm text-muted"><p>Postcard uses your trips and your friends’ trips—their ratings and notes—plus its own picks. Try:</p><div className="mt-3 flex flex-wrap gap-2">{starters.map(starter => <button key={starter} type="button" onClick={() => void send(starter)} className="chip text-left">{starter}</button>)}</div></div>}
          {turns.map((turn, index) => turn.role === 'preferences'
            ? <PreferencesSummary key={index} preferences={turn.preferences} />
            : turn.role === 'user'
            ? <p key={index} ref={index === lastQuestionIndex ? lastQuestion : undefined} className="ml-auto w-fit max-w-[85%] scroll-mt-28 whitespace-pre-wrap rounded-2xl rounded-br-sm bg-ink px-4 py-2 text-sm text-white">{turn.text}</p>
            : <div key={index} className="space-y-3"><p className="max-w-[92%] whitespace-pre-wrap text-sm leading-relaxed"><BoldText text={turn.text} /></p>
              {/* Each option folds up to its name, places and counts; tap to see its cards. A short single answer starts open. */}
              {groupByOption(turn.recommendations).map(([option, recs], _i, options) => <details key={option} open={options.length === 1 && recs.length <= 4} className="group rounded-xl border-l-4 bg-cream py-3 pl-3 pr-2" style={{ borderColor: colorOf(recs[0]) }}>
                <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-muted transition-transform group-open:rotate-90" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-[family-name:var(--font-playfair)] text-lg leading-tight" style={{ color: colorOf(recs[0]) }}>{option}</span>
                    <span className="block text-xs text-muted">{(towns => towns.length > 3 ? `${towns.slice(0, 3).join(' · ')} & more` : towns.join(' · '))([...new Set(recs.map(rec => rec.destination.split(',')[0].trim()).filter(Boolean))])}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{([['hotel', 'hotel', 'hotels'], ['food_drink', 'restaurant', 'restaurants'], ['activity', 'thing to do', 'things to do']] as const).map(([type, one, many]) => { const n = recs.filter(rec => rec.type === type).length; return n ? `${n} ${n === 1 ? one : many}` : null }).filter(Boolean).join(' · ')}</span>
                  </span>
                </summary>
                {sectionOrder.map(({ type, label, Icon }) => { const items = recs.filter(rec => rec.type === type); return items.length > 0 && <div key={type} className="mt-3">
                  <h4 className="type-label mb-1.5 flex items-center gap-1.5"><Icon size={13} />{label}</h4>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-2">{items.map(rec => <RecommendationCard key={rec.key} rec={rec} color={colorOf(rec)} grouped added={inTrip(rec)} busy={adding === rec.key} disabled={adding !== null} onAdd={() => void add(rec)} />)}</div>
                </div> })}
              </details>)}
            </div>)}
          {thinking && <p className="text-sm text-muted">Postcard is looking through your trips…</p>}
        </div>
        {error && <p role="alert" className="px-4 pb-2 text-sm text-danger">{error}</p>}
        <div ref={endOfChat} aria-hidden="true" style={{ scrollMarginBottom: 'calc(var(--app-bottom-clearance) + 4.5rem)' }} />
        {/* On phones the composer sticks just above the bottom navigation so it is always reachable. */}
        <form ref={form} style={pinnedTop === null ? undefined : { position: 'fixed', top: pinnedTop, left: 12, right: 12, bottom: 'auto', zIndex: 60 }} className={`sticky bottom-[calc(var(--app-bottom-clearance)-0.75rem)] z-10 flex items-end gap-2 border-t border-line-soft bg-card p-3 lg:static ${pinnedTop === null ? 'rounded-b-2xl' : 'rounded-2xl border shadow-pop'}`} onSubmit={event => { event.preventDefault(); void send(draft) }}>
          <textarea ref={composer} autoFocus={!!initialDraft} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft) } }} rows={1} maxLength={4000} placeholder="Ask about a place or a trip…" aria-label="Message Postcard" className="max-h-40 min-h-11 flex-1 resize-none overflow-y-auto rounded-xl border border-line bg-white px-3 py-2.5 text-base lg:text-sm outline-none focus:border-link" />
          <button type="submit" disabled={thinking || !draft.trim()} aria-label="Send" className="btn btn-primary w-11 shrink-0 !px-0"><ArrowUp size={18} /></button>
        </form>
      </section>
    </div>

    {mapView === 'hidden' || (mapView === 'auto' && !wide) ? null
    : <section aria-label="Map" className={`relative isolate order-first overflow-hidden rounded-2xl border border-line bg-card lg:order-none lg:h-auto ${mapView === 'small' ? 'h-[22dvh]' : 'h-[32dvh]'}`}>
      <div className="absolute right-3 top-3 z-[1000] flex gap-1.5">
        <button type="button" onClick={() => setMapView(mapView === 'small' ? 'normal' : 'small')} aria-label={mapView === 'small' ? 'Restore map size' : 'Shrink map'} title={mapView === 'small' ? 'Restore map size' : 'Shrink map'} className="flex size-9 items-center justify-center rounded-lg border border-line bg-card/95 text-ink shadow-card hover:bg-white">{mapView === 'small' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}</button>
        <button type="button" onClick={() => setMapView('hidden')} aria-label="Hide map" title="Hide map" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card/95 text-ink shadow-card hover:bg-white"><EyeOff size={16} /></button>
      </div>
      <TripMap places={mapPlaces} />
      {legend.length > 0 && <div aria-label="Trip ideas on the map" className="absolute bottom-3 left-3 z-[1000] max-w-[70%] space-y-1 rounded-xl bg-card/95 px-3 py-2 text-xs shadow-card">
        {legend.map(option => <p key={option} className="flex items-center gap-2"><span aria-hidden="true" className="size-3 shrink-0 rounded-full border-2 border-white shadow-card" style={{ background: optionColors[options.indexOf(option) % optionColors.length] }} /><span className="truncate">{option}</span></p>)}
      </div>}
    </section>}
  </div>
}

function RecommendationCard({ rec, color, grouped = false, added, busy, disabled, onAdd }: { rec: Recommendation; color: string; grouped?: boolean; added: boolean; busy: boolean; disabled: boolean; onAdd: () => void }) {
  const category = categories.find(category => category.value === rec.type) ?? categories[2]
  const [open, setOpen] = useState(false)
  const addButton = <button type="button" onClick={onAdd} disabled={added || disabled} className="chip">{added ? <><Check size={14} />Added</> : busy ? 'Adding…' : <><Plus size={14} />Add to trip</>}</button>
  return <article className="flex flex-col rounded-xl border border-line-soft bg-white p-3 transition-shadow hover:shadow-card">
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`View details for ${rec.name}`} className="flex flex-1 flex-col text-left">
      {/* In a grouped reply the idea and category are already in the headings above. */}
      {!grouped && <p className="mb-1 flex w-full items-center gap-1.5 text-label font-semibold uppercase tracking-wider text-muted"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} /><span className="min-w-0 truncate" style={{ color }}>{optionOf(rec)}</span><span aria-hidden="true">·</span><category.Icon size={12} className="shrink-0" />{category.eyebrow}</p>}
      <h3 className="type-card">{rec.name}</h3>
      <p className="text-xs text-muted">{[rec.destination, rec.country].filter(Boolean).join(', ')}</p>
      {rec.price && <p className="mt-2 text-sm font-semibold text-ink">{rec.price}</p>}
      <p className="mt-2 flex-1 text-sm">{rec.why}</p>
      <span className="mt-2 text-xs font-semibold text-link">{rec.source === 'claude' ? 'Photos & details →' : rec.source === 'you' ? 'Your notes & photos →' : `${rec.friendName}’s notes & photos →`}</span>
    </button>
    <div className="mt-3 flex items-center justify-between gap-2">
      <SourceBadge rec={rec} />
      {addButton}
    </div>
    {open && <PickDetails rec={rec} color={color} addButton={addButton} onClose={() => setOpen(false)} />}
  </article>
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="mt-4"><legend className="mb-2 text-sm font-semibold text-ink">{title}</legend><div className="flex flex-wrap gap-2">{children}</div></fieldset>
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
  const chip = (selected: boolean) => `min-h-10 rounded-full border px-3 text-sm ${selected ? 'border-link bg-mist font-semibold text-ink' : 'border-line text-link hover:bg-paper'}`
  return <section aria-label="Tell us about this trip" className="rounded-xl bg-cream p-4">
    <h2 className="type-title">Tell us about this trip</h2>
    <p className="mt-1 text-sm text-muted">{askTaste ? 'A few quick picks so the ideas actually fit you.' : 'We’ll use your past trips for your budget and taste—just tell us about this one.'}</p>
    <Group title="Who’s going?">{TRAVELERS.map(option => <button key={option} type="button" aria-pressed={travelers === option} onClick={() => setTravelers(option)} className={chip(travelers === option)}>{option}</button>)}</Group>
    <Group title="How long?">{TRIP_LENGTHS.map(option => <button key={option} type="button" aria-pressed={length === option} onClick={() => setLength(option)} className={chip(length === option)}>{option}</button>)}</Group>
    {askTaste && <>
      <Group title="Budget">{BUDGETS.map(option => <button key={option.value} type="button" aria-pressed={budget === option.value} onClick={() => setBudget(option.value)} className={chip(budget === option.value)}>{option.label} <span className="font-normal text-muted">{option.hint}</span></button>)}</Group>
      <Group title="Types of destination (pick any)">{DESTINATION_TYPES.map(option => <button key={option} type="button" aria-pressed={destinationTypes.includes(option)} onClick={() => setDestinationTypes(list => toggle(list, option))} className={chip(destinationTypes.includes(option))}>{option}</button>)}</Group>
      <Group title="Things you like to do (pick any)">{ACTIVITIES.map(option => <button key={option} type="button" aria-pressed={activities.includes(option)} onClick={() => setActivities(list => toggle(list, option))} className={chip(activities.includes(option))}>{option}</button>)}</Group>
    </>}
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="button" disabled={!ready || disabled} onClick={() => onSubmit({ travelers, length, budget: askTaste ? budget : null, destinationTypes: askTaste ? destinationTypes : [], activities: askTaste ? activities : [] })} className="btn btn-primary">Show me ideas →</button>
      <button type="button" onClick={onSkip} className="min-h-11 text-sm text-link underline">Skip, I’ll just ask</button>
    </div>
  </section>
}

function PreferencesSummary({ preferences }: { preferences: TravelPreferences }) {
  const budget = BUDGETS.find(option => option.value === preferences.budget)
  const parts = [preferences.travelers, preferences.length, budget?.label, preferences.destinationTypes.join(', '), preferences.activities.join(', ')].filter(Boolean)
  return <p className="ml-auto w-fit max-w-[85%] rounded-2xl border border-mist-line bg-mist px-4 py-2 text-xs text-ink"><span className="font-semibold">This trip:</span> {parts.join(' · ')}</p>
}

function SourceBadge({ rec }: { rec: Recommendation }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label font-semibold ${rec.source === 'claude' ? 'bg-mist text-link' : 'bg-mist text-link'}`}>{rec.source === 'claude' ? <><Sparkles size={11} />Postcard’s pick</> : rec.source === 'you' ? <><MapPin size={11} />Your past trip</> : <><Users size={11} />{rec.friendName}</>}</span>
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
        <h3 className={detailStyles.sectionTitle}>{who} notes{info?.rating ? <span className="ml-2 inline-block align-middle"><RatingStars value={info.rating} /></span> : null}</h3>
        {!info && !failed ? <p className={detailStyles.muted}>Loading…</p> : info?.notes ? <p className={detailStyles.text}>{info.notes}</p> : <p className={detailStyles.muted}>{rec.source === 'you' ? 'You didn’t add notes for this place.' : `${rec.friendName} didn’t add notes for this place.`}</p>}
        {info?.trip && <Link href={info.trip.href} className="mt-2 inline-block text-sm font-semibold text-link">From {rec.source === 'you' ? 'your' : `${rec.friendName}’s`} trip “{info.trip.title}” →</Link>}
      </section>}

      {!info && !failed ? <div className="h-56 animate-pulse rounded-lg bg-chip" aria-hidden="true" />
        : info && info.photos.length > 0 && <section>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-lg">{info.photos.map(photo => <figure key={photo.url} className="relative h-56 w-[85%] shrink-0 snap-center overflow-hidden rounded-lg bg-chip sm:w-[70%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            {photo.credit && <figcaption className="absolute bottom-1 right-2 rounded-lg bg-black/50 px-1.5 text-label text-white">{photo.credit}</figcaption>}
          </figure>)}</div>
          {info.photosFromGoogle && <p className="mt-1 text-label text-muted">Photos from Google{rec.source !== 'claude' ? ` · ${rec.source === 'you' ? 'you' : rec.friendName} didn’t add any` : ''}</p>}
        </section>}

      <section><h3 className={detailStyles.sectionTitle}>Why Postcard suggested it</h3><p className={detailStyles.text}>{rec.why}</p></section>
      {(rec.description || info?.description) && <section><h3 className={detailStyles.sectionTitle}>About</h3>
        {rec.description && <p className={detailStyles.text}>{rec.description}</p>}
        {info?.description && info.description !== rec.description && <p className={`${detailStyles.text} ${rec.description ? 'mt-2 text-muted' : ''}`}>{info.description}</p>}
        {info?.googleRating && <p className="mt-2 text-sm text-muted">★ {info.googleRating.value.toFixed(1)} on Google · {info.googleRating.count.toLocaleString()} reviews</p>}
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
  return pins.length ? <ItineraryMap pins={pins} /> : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">{places.length ? 'Finding places on the map…' : 'Suggestions and the places in your trip will appear here.'}</div>
}

// Past conversations, newest first, each labelled by its topic.
function PastChats({ history, currentId, limit }: { history: PastChat[]; currentId?: string; limit?: number }) {
  const [all, setAll] = useState(false)
  const shown = limit && !all ? history.slice(0, limit) : history
  return <><ul className="space-y-1">{shown.map(past => <li key={past.id}>
    <Link href={`/testplan?chat=${past.id}`} aria-current={past.id === currentId ? 'page' : undefined}
      className={`block rounded-xl px-3 py-2 text-sm hover:bg-paper ${past.id === currentId ? 'bg-mist font-semibold text-ink' : 'text-ink'}`}>
      <span className="block [overflow-wrap:anywhere]">{past.topic}</span>
      {past.summary && <span className="mt-0.5 line-clamp-2 block text-xs font-normal text-ink-soft">{past.summary}</span>}
      <span className="block text-xs font-normal text-muted">{new Date(past.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
    </Link>
  </li>)}</ul>
  {limit && history.length > limit && <button type="button" onClick={() => setAll(value => !value)} className="px-3 py-2 text-xs font-semibold text-link underline">{all ? 'Show fewer' : `Show all ${history.length}`}</button>}</>
}
