'use client'

import RatingStars from '@/components/RatingStars'
import { destinationRanges, stayOn, totalDays, type DayRange } from '@/lib/tripStays'

import Link from 'next/link'
import styles from '../../itinerary/[id]/places.module.css'
import planningStyles from './Planner.module.css'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Plus, MapPin, Trash2, LockKeyhole, Check, Hotel, Utensils, Camera, Plane, Upload, Pencil, Sparkles, Users } from 'lucide-react'
import { addPlanPlace, setPlanStartDate, editPlanPlace, savePlanDetails, removePlanPlace, savePublishDetails, removePlanDestination, renamePlanDestination, mergePlanDestination, setPlanDays, deletePlanDay, setPlaceDay, applyDayPlan, setTripCover } from '@/actions/planning'
import PlanImport from '@/components/PlanImport'
import PlaceEntryForm from '@/components/PlaceEntryForm'
import PlaceEditForm, { type PlaceEditValues, type PlaceType } from '@/components/PlaceEditForm'
import EventPhotoInput from '@/components/EventPhotoInput'
import PlaceQuickEdit from '@/components/PlaceQuickEdit'
import CoverPhotoPicker from '@/components/CoverPhotoPicker'
import { StarPicker } from '@/components/ui/Stars'
import { updatePlace } from '@/actions/placeQuickEdit'
import DeleteButton from '@/components/DeleteButton'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import PlanningMap from '@/components/PlanningMap'
import PlacePeople from '@/components/PlacePeople'
import SwipeToDelete from '@/components/SwipeToDelete'
import SortableDay from '@/components/SortableDay'
import PlacePhoto from '@/components/PlacePhoto'
import { placeTown } from '@/lib/placeTown'
import { DateFields, inputClass, buttonClass } from '../NewPlanForm'
import { TAGS, tagMeta } from '@/lib/tags'
import TagChip from '@/components/ui/TagChip'
import { samePlanDestination } from '@/lib/planPlaceIdentity'
import { getRecommendation } from '@/lib/placeRecommendation'
import { PostStamp } from '@/components/PostcardLogo'

type Place = { order: number; nights?: number | null; tags: string[]; lat: number | null; lng: number | null; placeId: string | null; id: string; name: string; type: string; notes: string | null; status: string; day: number | null; rating: number | null; photos: string[]; mealType: string | null; alternative: string | null; description: string | null; link: string | null; address: string | null }
type Trip = { coverPhoto?: string | null; tripPhotos?: string[]; notes?: string | null; bestMonths?: string[]; budget?: number | null; tripRating?: number | null; tags?: string[]; postType: string; durationDays?: number | null; id: string; title: string; audience: string; isPlan: boolean; visibility: string; start: string; end: string; destinations: { id: string; name: string; country: string | null; days?: number | null; items: Place[] }[] }
const categories = [{ value: 'hotel', label: 'Hotels', eyebrow: 'Stay', Icon: Hotel }, { value: 'food_drink', label: 'Restaurants', eyebrow: 'Food & drink', Icon: Utensils }, { value: 'activity', label: 'Activities', eyebrow: 'Explore', Icon: Camera }, { value: 'transport', label: 'Transportation', eyebrow: 'Getting around', Icon: Plane }]

// Day names in the planner: "Day 3", or the date when the plan has a start date and dates are chosen ("Thu, Jul 3").
// Days are still stored as numbers, so a posted trip always shows Day 1, Day 2…
type DayName = (day: number) => string
const DayNames = createContext<DayName>(day => `Day ${day}`)
function dateOfDay(start: string, day: number) {
  const date = new Date(`${start}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + day - 1)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
const DAY_MODE_KEY = 'postcard-day-names'

export default function Planner({ trip, initialImport = false, initialDetails = false, initialPost = false }: { trip: Trip; initialImport?: boolean; initialDetails?: boolean; initialPost?: boolean }) {
  const router = useRouter()
  // Day-by-day plans open on their days; idea lists on Places.
  const [tab, setTab] = useState<'places' | 'itinerary' | 'map'>(trip.durationDays ? 'itinerary' : 'places')
  const [mapOpened, setMapOpened] = useState(false)
  // Days or dates (remembered on this device). Dates need the plan's start date.
  // Day 1, Day 2… by default; calendar days only when turned on (remembered on this device).
  const [byDate, setByDate] = useState(false)
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(DAY_MODE_KEY) } catch { /* storage unavailable */ }
    if (saved) queueMicrotask(() => setByDate(saved === 'dates'))
  }, [])
  function chooseDayNames(dates: boolean) { setByDate(dates); try { localStorage.setItem(DAY_MODE_KEY, dates ? 'dates' : 'days') } catch { /* storage unavailable */ } }
  const showDates = byDate && !!trip.start
  const dayName: DayName = day => showDates ? dateOfDay(trip.start, day) : `Day ${day}`
  const [askingStart, setAskingStart] = useState(false)
  // Where the add-a-place form is open: the top button, under a destination's heading, or on an empty day.
  // The destination heading whose Edit panel is open.
  const [editingDestination, setEditingDestination] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ at: string; destination?: string; destinationId?: string; day?: number } | null>(null)
  const [importing, setImporting] = useState(initialImport)
  const [publishing, setPublishing] = useState(false)
  const [publishFormat, setPublishFormat] = useState<'guide' | 'day-trip' | 'itinerary' | null>(initialPost ? (trip.postType === 'guide' ? 'guide' : trip.postType === 'day-trip' ? 'day-trip' : 'itinerary') : null)
  // Prefilled from an earlier Continue, so going back to make changes keeps these choices.
  const [publishBudget, setPublishBudget] = useState(trip.budget ?? 0)
  const [publishRating, setPublishRating] = useState(trip.tripRating ?? 0)
  const [publishTags, setPublishTags] = useState<string[]>((trip.tags ?? []).filter(tag => tag !== 'day-trip'))
  const [publishMonths, setPublishMonths] = useState<string[]>(trip.bestMonths ?? [])
  // Every photo in the trip (trip photos, then each place's), for choosing the cover.
  const allPhotos = tripPhotoList(trip)
  const [publishCover, setPublishCover] = useState<string | null>(trip.coverPhoto ?? allPhotos[0] ?? null)
  const [publishMessage, setPublishMessage] = useState('')
  // After Continue: offer to rate places without a rating (not transport or alternatives) before the preview.
  // The places listed when the prompt opened; they stay listed (showing their new stars) as they're rated.
  const [unratedPrompt, setUnratedPrompt] = useState<string[] | null>(null)
  const places = trip.destinations.flatMap(d => d.items.map(item => ({ ...item, destinationId: d.id, destinationName: d.name, destination: [d.name, d.country].filter(Boolean).join(', ') })))
  // Trips with more than one destination split their places under a heading for each.
  const destinations = trip.destinations.filter(d => d.items.length || d.name !== 'Destination to decide')
  const multiDestination = destinations.length > 1
  // Destinations that start with the same name ("Capri" and "Capri, Metropolitan City of Naples, Italy"), grouped,
  // so the planner can offer to merge them. Each group keeps its shortest name.
  const lookAlikes = destinations.reduce<{ keep: typeof destinations[number]; others: typeof destinations }[]>((groups, destination) => {
    const group = groups.find(g => samePlanDestination(g.keep, destination))
    if (!group) return [...groups, { keep: destination, others: [] }]
    if (destination.name.length < group.keep.name.length) { group.others.push(group.keep); group.keep = destination } else group.others.push(destination)
    return groups
  }, []).filter(group => group.others.length > 0)
  const scheduled = [...new Set(places.flatMap(p => p.day === null ? [] : [p.day]))].sort((a, b) => a - b)
  // Days each destination (or a hotel stay) covers, when the person has set them.
  const ranges = destinationRanges(trip.destinations)
  const maxDay = Math.max(trip.durationDays ?? 0, ...scheduled, totalDays(trip.destinations), 1)
  const unrated = places.filter(place => place.type !== 'transport' && !place.rating && getRecommendation(place.tags) !== 'option')
  function renderPlace(place: Place & { destination: string; destinationName: string; destinationId: string }) { return <PlaceRow key={place.id} tripId={trip.id} place={place} maxDay={maxDay} destinationChoices={destinations.map(d => ({ id: d.id, name: d.name }))} /> }
  function addForm(at: string) { return adding?.at === at && !importing ? <AddPlace key={at} trip={trip} maxDay={maxDay} initialDestination={adding.destination} initialDestinationId={adding.destinationId} initialDay={adding.day} onClose={() => setAdding(null)} /> : null }
  function categorySections(items: typeof places) {
    return categories.map(category => { const inCategory = items.filter(p => p.type === category.value); return inCategory.length > 0 && <section key={category.value} className="mb-7"><div className={`${styles.categoryHeading} ${styles[category.value]}`}><h3><span className={styles.categoryIcon}><category.Icon size={17} /></span>{category.label}</h3><span className={styles.count}>{inCategory.length} {inCategory.length === 1 ? 'place' : 'places'}</span></div><div className="space-y-3">{inCategory.map(renderPlace)}</div></section> })
  }
  // An empty day suggests the destination of the closest earlier day that has places.
  function dayDestination(day: number) { return stayOn(day, trip.destinations, ranges).destination ?? places.filter(p => p.day !== null && p.day < day).sort((a, b) => b.day! - a.day!)[0]?.destinationName }
  function showPreview() { setUnratedPrompt(null); router.push(`/itinerary/${trip.id}?preview=1`) }
  // Continue saves these details on the still-private plan, then shows the trip exactly as it will be posted.
  // Posting happens from that preview.
  async function continueToPreview(format: 'guide' | 'day-trip' | 'itinerary') {
    if (publishing) return
    setPublishing(true); setPublishMessage('')
    try {
      if (publishCover && publishCover !== trip.coverPhoto) {
        const cover = await setTripCover(trip.id, publishCover)
        if (cover.error) { setPublishMessage(cover.error); return }
      }
      const result = await savePublishDetails(trip.id, format, { budget: publishBudget, tripRating: publishRating, tags: publishTags, bestMonths: publishMonths })
      if (result.error) setPublishMessage(result.error)
      else { setPublishFormat(null); if (unrated.length) setUnratedPrompt(unrated.map(place => place.id)); else showPreview() }
    } catch { setPublishMessage('Could not save these details. Please try again.') }
    finally { setPublishing(false) }
  }
  return <DayNames.Provider value={dayName}><div className="mx-auto max-w-2xl px-4 py-6 text-ink">
    <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-link"><LockKeyhole size={14} />{trip.visibility === 'draft' ? 'Private plan · Only you' : 'Shared trip'}</div>
    <h1 className="trip-title mt-2 break-words font-[family-name:var(--font-playfair)] text-display sm:text-display-lg">{trip.title}</h1>
    {<details id="trip-details" open={initialDetails || undefined} className="mt-3 scroll-mt-24"><summary className="flex cursor-pointer list-none items-center gap-1.5 py-2 text-sm text-link [&::-webkit-details-marker]:hidden"><Pencil size={14} />Edit trip details</summary><DetailsForm key={`${trip.title}:${trip.start}:${trip.end}`} trip={trip} /></details>}
    {trip.visibility !== 'draft' && <div className="mt-4 flex flex-wrap items-center gap-3">
      {<Link href={`/itinerary/${trip.id}`} className="btn btn-outline">View shared trip</Link>}
      <span className="text-xs text-muted">Saved changes appear on your shared trip.</span>
    </div>}
    {/* One row of compact actions, so the places start higher up the screen. */}
    <div className="sticky top-[var(--app-header-height,0px)] z-20 -mx-1 mt-3 grid grid-cols-4 items-start gap-2 bg-paper px-1 py-3">
      <button type="button" onClick={() => { setImporting(false); setAdding({ at: 'top' }) }} className={action}><span className={`${actionIcon} border-ink bg-ink text-white`}><Plus size={22} /></span>Add a place</button>
      <Link href={`/plan/${trip.id}/friends`} className={action}><span className={`${actionIcon} border-line bg-card text-ink`}><Users size={22} strokeWidth={1.75} /></span>Browse friends’ places</Link>
      <button type="button" onClick={() => { setAdding(null); setImporting(true) }} aria-expanded={importing} aria-controls="plan-import-panel" className={action}><span className={`${actionIcon} border-line bg-card text-ink`}><Upload size={22} strokeWidth={1.75} /></span>Import notes or files</button>
      {/* This trip's AI chat: it sees the trip's places and can add its picks here. */}
      <Link href={`/testplan?trip=${trip.id}&from=planner`} className={action}><span className={`${actionIcon} border-mist-line bg-mist text-ink`}><Sparkles size={22} strokeWidth={1.75} /></span>Plan with AI</Link>
    </div>
    {addForm('top')}
    {importing && <div id="plan-import-panel"><PlanImport tripId={trip.id} destinations={destinations.filter(d => d.name !== 'Destination to decide').map(d => ({ name: d.name, country: d.country }))} onClose={() => setImporting(false)} /></div>}
    <div role="tablist" aria-label="Trip view" className="tabs mb-5 mt-3">{(['places', 'itinerary', 'map'] as const).map(value => <button key={value} role="tab" id={`${value}-tab`} aria-controls="trip-panel" aria-selected={tab === value} onClick={() => { setTab(value); if (value === 'map') setMapOpened(true) }} className="tab">{value === 'places' ? 'Places' : value === 'map' ? 'Map' : 'Itinerary'}</button>)}</div>
    <section role="tabpanel" id="trip-panel" aria-labelledby={`${tab}-tab`}>
      {mapOpened && <div hidden={tab !== 'map'}><PlanningMap places={places.filter(place => place.type !== 'transport' || place.placeId || (place.lat !== null && place.lng !== null)).map(place => ({ id: place.id, name: place.name, city: place.destination, type: place.type === 'hotel' ? 'hotel' : place.type === 'food_drink' ? 'food_drink' : place.type === 'transport' ? 'transport' : 'activity', day: place.day, placeId: place.placeId ?? undefined, lat: place.lat, lng: place.lng }))} /></div>}
      {tab === 'itinerary' && !places.length && (trip.durationDays ? <p className="mb-4 text-sm text-muted">Your {trip.durationDays}-day trip. Add places and choose a day for each.</p> : <TripDaysPrompt tripId={trip.id} />)}
      {/* A plan with several destinations shows their headings (each with Add a place) even before anything is added. */}
      {tab === 'map' ? null : !places.length && !(multiDestination && tab === 'places') && !(tab === 'itinerary' && trip.durationDays) ? <div className="panel-dashed p-8 text-center"><MapPin size={28} className="mx-auto mb-3 text-link" /><h2 className="type-title">A place to start</h2><p className="mt-2 text-sm text-muted">A hotel you love, a restaurant someone mentioned, something you want to do. Add it now and decide when later.</p></div> : tab === 'places' ? <>
        <p className="mb-5 text-sm text-muted">Everything you’re considering, all in one place. Days are optional.</p>
        {lookAlikes.map(group => <MergeLookAlikes key={group.keep.id} tripId={trip.id} keep={group.keep} others={group.others} />)}
        {multiDestination ? destinations.map(destination => { const items = places.filter(p => p.destinationId === destination.id); return <section key={destination.id} aria-label={destination.name} className="mb-10">
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2"><h2 className="type-title flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]"><MapPin size={18} className="shrink-0 text-link" />{destination.name}</h2><span className="flex shrink-0 items-center gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-muted">{items.length} {items.length === 1 ? 'place' : 'places'}</span><button type="button" aria-expanded={editingDestination === destination.id} onClick={() => setEditingDestination(current => current === destination.id ? null : destination.id)} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-link"><Pencil size={14} />Edit</button></span></div>
          {editingDestination === destination.id && <DestinationEditor key={destination.id} tripId={trip.id} destination={destination} places={items.length} others={destinations.filter(other => other.id !== destination.id)} onClose={() => setEditingDestination(null)} />}
          {/* Adds here search near this destination. */}
          <button type="button" onClick={() => { setImporting(false); setAdding({ at: `destination:${destination.id}`, destination: destination.name, destinationId: destination.id }) }} className="mb-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-link px-4 text-sm font-semibold text-link hover:bg-mist"><Plus size={16} />Add a place in {destination.name}</button>
          {addForm(`destination:${destination.id}`)}
          {categorySections(items)}
        </section> }) : categorySections(places)}
      </> : <>
        {!trip.durationDays && <TripDaysPrompt tripId={trip.id} />}
        {/* One switch: plan by calendar days. Turning it on asks for the start date if the plan has none. */}
        {!!trip.durationDays && <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" aria-pressed={showDates} onClick={() => { if (showDates) { chooseDayNames(false); setAskingStart(false) } else if (trip.start) chooseDayNames(true); else setAskingStart(value => !value) }} className="chip"><CalendarDays size={14} />Plan by calendar days</button>
          {showDates && <button type="button" aria-expanded={askingStart} onClick={() => setAskingStart(value => !value)} className="text-sm font-semibold text-link underline underline-offset-2">Change dates</button>}
          {showDates && <span className="type-meta w-full">Posted trips show Day 1, Day 2…</span>}
        </div>}
        {/* Right here, so you don't have to scroll up to the trip details. */}
        {askingStart && <StartDateForm tripId={trip.id} initial={trip.start} onDone={() => { setAskingStart(false); chooseDayNames(true) }} />}
        {Array.from({ length: maxDay }, (_, index) => index + 1).filter(day => trip.durationDays || scheduled.includes(day)).map(day => { const dayPlaces = places.filter(p => p.day === day).sort((a, b) => a.order - b.order); const stay = stayOn(day, trip.destinations, ranges); const dayLocation = stay.destination ?? [...new Set(dayPlaces.map(p => p.destinationName))].filter(name => name !== 'Destination to decide').join(' · '); return <section key={day} className="mb-6"><h2 className={styles.dayHeading}>{dayName(day)}{showDates && <span className="font-sans text-sm text-muted">Day {day}</span>}{dayLocation && <span className="font-sans text-sm text-muted">{dayLocation}</span>}</h2>{stay.hotel && <p className="mb-3 flex items-center gap-1.5 text-sm text-link"><Hotel size={16} />Staying at {stay.hotel}</p>}{/* Add a place stays at the bottom of each day, also once the day has places. */}{dayPlaces.length > 0 && <div className="mb-3"><SortableDay tripId={trip.id} places={dayPlaces} render={renderPlace} /></div>}{adding?.at !== `day:${day}` && <button type="button" onClick={() => { setImporting(false); setAdding({ at: `day:${day}`, day, destination: dayDestination(day) }) }} className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-3 text-sm font-semibold text-link hover:bg-mist"><Plus size={16} />Add a place</button>}
          {addForm(`day:${day}`)}
          {!!trip.durationDays && trip.durationDays > 1 && <DeleteDay tripId={trip.id} day={day} places={dayPlaces.length} />}</section> })}
        {!!trip.durationDays && <AddDay tripId={trip.id} days={trip.durationDays} />}
        <section><h2 className={styles.dayHeading}>Unscheduled</h2>
          {!!trip.durationDays && places.some(p => p.day === null) && <OrganizeWithAI tripId={trip.id} places={places} />}<div className="space-y-3">{places.filter(p => p.day === null).map(place => trip.durationDays ? <PlaceRow key={place.id} tripId={trip.id} place={place} maxDay={maxDay} destinationChoices={destinations.map(d => ({ id: d.id, name: d.name }))} dayChips={trip.durationDays} dayRange={ranges.get(place.destinationId)} /> : renderPlace(place))}</div>{places.length > 0 && places.every(p => p.day !== null) && <p className="text-sm text-muted">All your places have a day.</p>}{!places.length && <p className="text-sm text-muted">Places you haven’t put on a day yet show here.</p>}</section>
      </>}
    </section>
    <div className="mt-8 border-t border-line pt-5"><div className="flex flex-wrap items-center justify-between gap-3">{/* Post on the left, delete on the right (also when there's nothing to post). */}{trip.visibility === 'draft' && <button type="button" disabled={publishing} onClick={() => setPublishFormat(trip.postType === 'guide' ? 'guide' : trip.postType === 'day-trip' ? 'day-trip' : 'itinerary')} aria-label="Post trip" title="Post trip" className="pointer-events-auto relative inline-flex size-20 items-center justify-center transition-transform hover:-rotate-6 hover:scale-105 disabled:opacity-60"><PostStamp size={80} /><span className="sr-only">Post</span></button>}<div className="pointer-events-auto ml-auto"><DeleteButton id={trip.id} visibility={trip.visibility} returnTo="/plan" /></div></div></div>
    {trip.visibility === 'draft' && publishFormat && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-ink/50 px-4 py-6 [grid-template-columns:minmax(0,1fr)]" role="dialog" aria-modal="true" aria-labelledby="publish-format-heading"><div className="panel w-full max-w-md p-5 shadow-pop"><div className="flex items-start justify-between gap-4"><div><h2 id="publish-format-heading" className="type-title">A few more details</h2><p className="mt-1 text-sm text-muted">Add a few details before sharing your trip.</p></div><button type="button" onClick={() => setPublishFormat(null)} className="text-title leading-none text-muted" aria-label="Close">×</button></div><div className="mt-5 space-y-5">{allPhotos.length > 0 && <fieldset><legend className="mb-1 text-sm font-semibold text-link">Choose cover photo</legend><p className="mb-1 text-xs text-muted">The photo people see first. Scroll sideways to see them all.</p><CoverPhotoPicker photos={allPhotos} value={publishCover} onChange={setPublishCover} /></fieldset>}<fieldset><legend className="mb-2 text-sm font-semibold text-link">Trip type</legend><div className="grid grid-cols-3 gap-2">{([['guide', 'Guide'], ['day-trip', 'Day trip'], ['itinerary', 'Multi-day']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={publishFormat === value} onClick={() => setPublishFormat(value)} className="chip justify-center">{label}</button>)}</div></fieldset><TripExtras budget={publishBudget} onBudget={setPublishBudget} rating={publishRating} onRating={setPublishRating} tags={publishTags} onTags={setPublishTags} legendClass="mb-2 text-sm font-semibold text-link" months={<MonthPicker value={publishMonths} onChange={setPublishMonths} legendClass="mb-1 text-sm font-semibold text-link" />} /><button type="button" disabled={publishing} onClick={() => void continueToPreview(publishFormat)} className="btn btn-primary w-full">{publishing ? 'Saving…' : 'Continue →'}</button></div></div></div>}
    {publishMessage && <p role="status" className="mt-2 text-right text-sm text-link">{publishMessage}</p>}
    {unratedPrompt && <UnratedPrompt places={places.filter(place => unratedPrompt.includes(place.id))} onClose={() => setUnratedPrompt(null)} onPreview={showPreview} />}
  </div></DayNames.Provider>
}

function AddPlace({ trip, maxDay, initialDestination, initialDestinationId, initialDay, onClose }: { trip: Trip; maxDay: number; initialDestination?: string; initialDestinationId?: string; initialDay?: number; onClose: () => void }) {
  const dayName = useContext(DayNames)
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const clientId = useRef('')
  const [category, setCategory] = useState<'hotel' | 'food_drink' | 'activity' | 'transport'>('hotel')
  const [uploading, setUploading] = useState(false)
  const [day, setDay] = useState(initialDay ? String(initialDay) : '')
  // Hotels: nights from the check-in day. Starts from the destination's days when they're set.
  const [nights, setNights] = useState('')
  // New places are saved as "Want to go"; there's no booking-status choice.
  const status = 'considering'
  // Added from a destination or a day: that destination. Otherwise the person picks (a one-destination trip picks itself).
  const realDestinations = trip.destinations.filter(d => d.name !== 'Destination to decide')
  const [destination, setDestination] = useState(initialDestination ?? (realDestinations.length === 1 ? realDestinations[0].name : ''))
  const [destinationId, setDestinationId] = useState<string | null>(initialDestinationId ?? trip.destinations.find(d => d.name === (initialDestination ?? (realDestinations.length === 1 ? realDestinations[0].name : '')))?.id ?? null)
  const selectedDestination = trip.destinations.find(d => d.id === destinationId) ?? trip.destinations.find(d => d.name === destination)
  const city = [destination, selectedDestination?.country].filter(Boolean).join(', ')
  function changeDestination(value: string, id: string | null = null) { setDestination(value); setDestinationId(id) }
  const stayRange = selectedDestination ? destinationRanges(trip.destinations).get(selectedDestination.id) : undefined
  // Choosing Hotel suggests a check-in on the destination's first day, for all of its days.
  const [suggested, setSuggested] = useState(false)
  if (category === 'hotel' && stayRange && !suggested && !nights) {
    // From the chosen day (or the destination's first) to the destination's last day.
    const checkIn = day && Number(day) >= stayRange.start && Number(day) <= stayRange.end ? Number(day) : stayRange.start
    setSuggested(true); setDay(String(checkIn)); setNights(String(stayRange.end - checkIn + 1))
  }

  const nightsSelect = <label className="block text-xs uppercase tracking-wide text-link">How many nights?<select value={nights} onChange={event => setNights(event.target.value)} className={inputClass}><option value="">Not sure yet</option>{Array.from({ length: 30 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} {value === 1 ? 'night' : 'nights'}</option>)}</select></label>
  return <section className="panel mb-4 space-y-3 p-4" aria-label="Add a place"><button type="button" onClick={onClose} className="text-sm text-link">← Back</button><h2 className="type-title">Add a place</h2><p className="text-sm text-muted">Save places to your trip. Add notes now. If you’ve already been, add a rating too.</p><fieldset disabled={busy || uploading} className="space-y-3">
    <DestinationPicker destinations={trip.destinations.map(d => ({ id: d.id, name: d.name }))} value={destination} selectedId={destinationId} onChange={changeDestination} labelClass="mb-1 text-sm" />
    <fieldset><legend className="mb-2 text-sm">Category</legend><div className="flex flex-wrap gap-2">
      {[
        { value: 'hotel', label: 'Hotel / Airbnb', Icon: Hotel },
        { value: 'food_drink', label: 'Food / Drink', Icon: Utensils },
        { value: 'activity', label: 'Activity', Icon: Camera },
        { value: 'transport', label: 'Transport', Icon: Plane },
      ].map(({ value, label, Icon }) => <label key={value}>
        <input type="radio" name="type" value={value} checked={category === value} onChange={() => setCategory(value as 'hotel' | 'food_drink' | 'activity' | 'transport')} className="peer sr-only" />
        <span className="chip"><Icon size={14} />{label}</span>
      </label>)}
    </div></fieldset>
    </fieldset>
    <PlaceEntryForm planning type={category} city={city || undefined} onPhotoBusyChange={setUploading} onClose={onClose} onAdd={async item => {
      if (saving.current) return false
      if (!destination.trim()) { setError('Choose a destination first.'); return false }
      saving.current = true; setBusy(true); setError('')
      if (!clientId.current) clientId.current = crypto.randomUUID()
      const data = new FormData()
      for (const [key, value] of Object.entries({ ...item, destination, destinationId: destinationId ?? '', day, ...(category === 'hotel' && nights ? { nights } : {}), status, clientId: clientId.current })) data.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
      try {
        const result = await addPlanPlace(trip.id, data)
        if (result.error) { setError(result.error); return false }
        router.refresh(); onClose(); return true
      } catch { setError('Could not save. Your place is still here; try again.'); return false }
      finally { saving.current = false; setBusy(false) }
    }}>
      {/* Day-by-day trips ask which day right away; idea lists keep it tucked away. */}
      {trip.durationDays ? <label className="block text-xs uppercase tracking-wide text-link">{category === 'hotel' ? 'Check-in day' : 'Which day?'}<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>{dayName(value)}</option>)}</select></label>
      : <details><summary className="text-sm text-link">{category === 'hotel' ? 'Add check-in day and nights (optional)' : 'Add a day (optional)'}</summary>
      <label className="block text-sm">Day (optional)<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>{dayName(value)}</option>)}</select></label>
      {category === 'hotel' && nightsSelect}
      </details>}
      {trip.durationDays && category === 'hotel' ? nightsSelect : null}
    </PlaceEntryForm>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </section>
}

// After "A few more details" → Continue: rate places that have no rating, right here. Each tap saves.
function UnratedPrompt({ places, onClose, onPreview }: { places: (Place & { destination: string })[]; onClose: () => void; onPreview: () => void }) {
  const router = useRouter()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const remaining = places.filter(place => !ratings[place.id]).length
  async function rate(id: string, value: number) {
    if (saving) return
    const previous = ratings[id] ?? 0
    setRatings(current => ({ ...current, [id]: value })); setSaving(id); setError('')
    try {
      const result = await updatePlace(id, { kind: 'rating', rating: value })
      if (result.error) { setError(result.error); setRatings(current => ({ ...current, [id]: previous })) } else router.refresh()
    } catch { setError('Could not save that rating. Please try again.'); setRatings(current => ({ ...current, [id]: previous })) }
    finally { setSaving(null) }
  }
  return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-ink/50 px-4 py-6 [grid-template-columns:minmax(0,1fr)]" role="dialog" aria-modal="true" aria-labelledby="unrated-heading">
    <div className="panel w-full max-w-md min-w-0 p-5 shadow-pop">
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 id="unrated-heading" className="type-title">Rate your places?</h2><p className="mt-1 text-sm text-muted">{remaining === 0 ? 'All rated. Thanks!' : remaining === 1 ? 'One place doesn’t have a rating yet.' : `${remaining} places don’t have a rating yet.`} Ratings help friends know what to prioritize.</p></div><button type="button" onClick={onClose} className="shrink-0 text-title leading-none text-muted" aria-label="Close">×</button></div>
      <ul className="mt-4 max-h-[50dvh] divide-y divide-line-soft overflow-y-auto">{places.map(place => <li key={place.id} className="min-w-0 py-3">
        <p className="text-sm font-semibold [overflow-wrap:anywhere]">{place.name}</p>
        <p className="text-xs text-muted">{categories.find(category => category.value === place.type)?.eyebrow ?? 'Place'}</p>
        <div className="mt-1 flex items-center"><StarPicker value={ratings[place.id] ?? 0} onChange={value => void rate(place.id, value)} name={place.name} disabled={!!saving} />{saving === place.id ? <span className="ml-2 text-xs text-muted">Saving…</span> : ratings[place.id] ? <span className="ml-2 flex items-center gap-1 text-xs text-link"><Check size={12} />Saved</span> : null}</div>
      </li>)}</ul>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <button type="button" onClick={onPreview} disabled={!!saving} className="btn btn-primary mt-4 w-full">{remaining === 0 ? 'Preview my trip →' : 'Skip, preview my trip →'}</button>
    </div>
  </div>
}

function PlaceRow({ tripId, place, maxDay, destinationChoices, dayChips, dayRange }: { tripId: string; place: Place & { destination: string; destinationName: string; destinationId: string }; maxDay: number; destinationChoices: { id: string; name: string }[]; dayChips?: number; dayRange?: DayRange }) {
  const dayName = useContext(DayNames)
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [removing, setRemoving] = useState(false)
  const saving = useRef(false)
  const [placeId, setPlaceId] = useState(place.placeId ?? '')
  const [photos, setPhotos] = useState(place.photos)
  const [day, setDay] = useState(place.day === null ? '' : String(place.day))
  const [nights, setNights] = useState(place.nights ? String(place.nights) : '')
  const [type, setType] = useState(place.type)
  const [destination, setDestination] = useState(place.destinationName)
  const [destinationId, setDestinationId] = useState<string | null>(place.destinationId)
  const [uploading, setUploading] = useState(false)
  const [foundAddress, setFoundAddress] = useState<string | null>(null)
  const category = categories.find(category => category.value === place.type) ?? categories[2]
  function openEditor() { setType(place.type); setDestination(place.destinationName); setDestinationId(place.destinationId); setPlaceId(place.placeId ?? ''); setPhotos(place.photos); setDay(place.day === null ? '' : String(place.day)); setNights(place.nights ? String(place.nights) : ''); setEditing(true); setError(''); setSaved(false) }
  async function save(values: PlaceEditValues) {
    if (saving.current || uploading) return
    saving.current = true; setBusy(true); setError('')
    const data = new FormData()
    for (const [key, value] of Object.entries({ name: values.name, category: type, destination, destinationId: destinationId ?? '', placeId, status: place.status, notes: values.notes, day, ...(type === 'hotel' ? { nights } : {}), mealType: values.mealType,
      tags: JSON.stringify(values.tags), alternative: values.alternative, description: values.description, link: values.link, address: values.address, photos: JSON.stringify(photos) })) data.set(key, value)
    try { const result = await editPlanPlace(place.id, data); if (result.error) setError(result.error); else { setEditing(false); setSaved(true); router.refresh() } }
    catch { setError('Could not save. Your changes are still here; try again.') }
    finally { saving.current = false; setBusy(false) }
  }
  const Icon = category.Icon
  async function remove() {
    const result = await removePlanPlace(place.id)
    if (result.error) return result.error
    router.refresh()
  }
  // Swipe left (or hover on a computer) to delete; off while the place's edit form is open.
  return <SwipeToDelete title={place.name} disabled={editing} className="" confirmLabel="Delete place" keepLabel="Keep place" onDelete={remove}
    message={<>Delete <span className="font-semibold">{place.name}</span> and its notes? The rest of your trip will stay.</>}>
  <article id={`place-${place.id}`} className={`${planningStyles.place} ${styles[category.value]} scroll-mt-40`}>
      {/* Tapping the photo or text opens the place with its full notes and details. */}
      <div role="button" tabIndex={0} aria-label={`Open ${place.name}`} onClick={() => { if (!editing) openEditor() }} onKeyDown={event => { if (!editing && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openEditor() } }} className={`${styles.card} ${planningStyles.card} cursor-pointer`}>
      <PlacePhoto itemId={place.id} name={place.name} photos={place.photos} onAddress={setFoundAddress} thumbnailClass={styles.thumbnail} fallback={<div className={styles.keepsake} aria-hidden="true"><span>{category.eyebrow}</span><Icon size={28} strokeWidth={1} /><span>{place.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span></div>} />
      <div className={styles.cardBody}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={styles.eyebrow}>{category.eyebrow}</p>
          {getRecommendation(place.tags) === 'option' && <span className="rounded-full border border-mist-line bg-mist px-2.5 py-1 text-label font-semibold uppercase tracking-wider text-link">Alternative</span>}
        </div>
        <h3 className={styles.placeName}>{place.name}</h3>
        {/* The place's own town once Google has it; until then, the destination it's filed under. */}
        <p className={planningStyles.location}>{place.address || foundAddress ? placeTown(place.address || foundAddress!) : place.destination}</p>
        {!!place.rating && <p className="mt-1"><RatingStars value={place.rating} label={`Your rating: ${place.rating} out of 5`} /></p>}
        {place.notes && <p className={styles.note}>{place.notes}</p>}
        {/* Opens this trip's AI chat with a question about this place ready to finish. */}
        <Link href={`/testplan?trip=${tripId}&ask=${place.id}&from=planner&new=1`} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} className="relative z-[2] mt-2 inline-flex items-center gap-1 text-xs font-semibold text-link underline-offset-2 hover:underline"><Sparkles size={12} />Ask AI about this place</Link>
      </div>
    </div>
    {!!dayChips && <DayChips itemId={place.id} days={dayChips} range={dayRange} destination={place.destinationName} />}
    {place.type !== 'transport' && <PlacePeople key={`${place.placeId}:${place.name}:${place.destination}`} compact placeId={place.placeId ?? ''} name={place.name} location={place.destination} itemId={place.id} />}
    <div className={planningStyles.controls}>
    {!editing ? <PlaceQuickEdit compact row itemId={place.id} name={place.name} type={category.value as PlaceType} tags={place.tags} rating={place.rating} photos={place.photos}
        leading={<button onClick={openEditor} type="button" className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs text-link sm:text-sm"><Pencil size={16} />Edit details</button>} />
      : <div className="w-full">
        {/* Same fields as the trip editor, plus photos and the day for this plan. */}
        <PlaceEditForm key={type} type={type as PlaceType} city={place.destination} busy={busy || uploading} saveLabel="Save changes" showRating={false} onPlaceIdChange={setPlaceId} onClose={() => setEditing(false)} onSave={values => void save(values)}
          initial={{ name: place.name, mealType: place.mealType ?? '', rating: place.rating ?? 0, notes: place.notes ?? '', tags: place.tags, isHighlight: false, alternative: place.alternative ?? '', description: place.description ?? '', link: place.link ?? '', address: place.address ?? '' }}>
          <div className="space-y-1"><p className="text-xs text-muted">Photos</p><EventPhotoInput photos={photos} name={place.name} onChange={setPhotos} onBusyChange={setUploading} /></div>
          {/* Moving a place to another destination puts it under that destination's heading. */}
          <DestinationPicker destinations={destinationChoices} value={destination} selectedId={destinationId} onChange={(name, id) => { setDestination(name); setDestinationId(id) }} labelClass="mb-1 text-xs text-muted" />
          <fieldset><legend className="mb-1 text-xs text-muted">Category</legend><div className="flex flex-wrap gap-1.5">{categories.map(option => <button key={option.value} type="button" aria-pressed={type === option.value} onClick={() => setType(option.value)} className="chip"><option.Icon size={14} />{option.label}</button>)}</div></fieldset>
          <label className="block text-xs text-muted">{type === 'hotel' ? 'Check-in day (optional)' : 'Day (optional)'}<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>{dayName(value)}</option>)}</select></label>
          {/* Hotels: how many nights, from the check-in day. The itinerary shows the stay on those days. */}
          {type === 'hotel' && <label className="block text-xs text-muted">Nights (optional)<select value={nights} onChange={event => setNights(event.target.value)} className={inputClass}><option value="">Not set</option>{Array.from({ length: 30 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} {value === 1 ? 'night' : 'nights'}</option>)}</select></label>}
        </PlaceEditForm>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </div>}
    {saved && <p role="status" className="flex items-center gap-1 text-xs text-link"><Check size={14} />Saved</p>}
    {editing && <div className="w-full">{!removing ? <button type="button" aria-label={`Delete ${place.name}`} className="min-h-11 text-xs text-danger" onClick={() => setRemoving(true)}>Delete place</button> : <div className="text-sm"><p>Delete this place and its notes? The rest of your trip will stay.</p><button type="button" disabled={busy} className="min-h-11 pr-4 text-danger" onClick={async () => {
      if (saving.current) return
      saving.current = true; setBusy(true); setError('')
      try { const result = await removePlanPlace(place.id); if (result.error) setError(result.error); else router.refresh() }
      catch { setError('Could not remove. Please try again.') } finally { saving.current = false; setBusy(false) }
    }}>{busy ? 'Deleting…' : 'Delete this place'}</button><button type="button" disabled={busy} className="min-h-11" onClick={() => setRemoving(false)}>Keep place</button></div>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}</div>}
    </div>
  </article>
  </SwipeToDelete>
}
// Planner action row: a round icon button with its label underneath.
const action = 'group flex flex-col items-center gap-1.5 text-center text-xs leading-tight text-ink'
const actionIcon = 'flex size-14 items-center justify-center rounded-full border shadow-card transition-transform group-active:scale-95'
// Budget, overall rating (it sets the Must go! / Loved it stamp) and travel-style tags: chosen when posting, and
// changeable afterwards in Edit trip details. Day trip isn't a tag here; it follows the trip type.
function TripExtras({ budget, onBudget, rating, onRating, tags, onTags, legendClass, months }: { budget: number; onBudget: (value: number) => void; rating: number; onRating: (value: number) => void; tags: string[]; onTags: (value: string[]) => void; legendClass: string; months?: React.ReactNode }) {
  return <>
    <fieldset><legend className={legendClass}>Budget</legend><div className="flex gap-2">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" onClick={() => onBudget(budget === value ? 0 : value)} className={`text-title ${value <= budget ? 'text-gold' : 'text-gold-faint'}`} aria-label={`${value} dollar signs`}>$</button>)}</div></fieldset>
    <fieldset><legend className={legendClass}>Overall trip rating</legend><div className="flex gap-1"><StarPicker value={rating} onChange={onRating} name="trip" size={26} /></div></fieldset>
    {months}
    <fieldset><legend className={legendClass}>Tags</legend><div className="flex flex-wrap gap-2">{TAGS.filter(tag => tag.id !== 'day-trip').map(tag => <TagChip key={tag.id} id={tag.id} selected={tags.includes(tag.id)} onToggle={() => onTags(tags.includes(tag.id) ? tags.filter(value => value !== tag.id) : [...tags, tag.id])} />)}</div></fieldset>
  </>
}
// "Positano, SA, Italy, Italy" → "Positano, SA, Italy": a name saved with its country added twice.
function cleanDestination(name: string) { return name.split(',').map(part => part.trim()).filter((part, index, parts) => part && part.toLowerCase() !== parts[index - 1]?.toLowerCase()).join(', ') }

// Which destination a place goes under: your trip's destinations as buttons, or "Somewhere else…" to type a new one.
// Nothing is chosen for you unless the place already belongs somewhere (editing) or was added from a destination or day.
function DestinationPicker({ destinations, value, selectedId, onChange, labelClass }: { destinations: { id: string; name: string }[]; value: string; selectedId: string | null; onChange: (name: string, id: string | null) => void; labelClass: string }) {
  const options = destinations.filter(d => d.name !== 'Destination to decide')
  const [typing, setTyping] = useState(!options.length || (!!value && !selectedId && !options.some(d => d.name === value)))
  // Each button is one destination (by id), so two that read alike, like two "Positano"s, stay separate.
  return <fieldset className="space-y-1.5"><legend className={labelClass}>Destination</legend>
    {options.length > 0 && <div className="flex flex-wrap gap-1.5">
      {options.map(d => <button key={d.id} type="button" aria-pressed={!typing && selectedId === d.id} onClick={() => { setTyping(false); onChange(d.name, d.id) }} className="chip">{cleanDestination(d.name)}</button>)}
      <button type="button" aria-pressed={typing} onClick={() => { setTyping(true); onChange('', null) }} className="chip"><Plus size={14} />Somewhere else…</button>
    </div>}
    {typing && <PlacesAutocomplete maxLength={160} value={value} onChange={name => onChange(name, null)} onSelect={(main, secondary) => onChange(cleanDestination([main, secondary].filter(Boolean).join(', ')), null)} type="destination" placeholder="City or area" aria-label="New destination" className={inputClass} />}
  </fieldset>
}

// Two or more destinations that look like the same place: ask, then merge them into the shortest name (their
// places, days and hotel stays move across). Asked rather than automatic: "Springfield, IL" and "Springfield, MO" differ.
function MergeLookAlikes({ tripId, keep, others }: { tripId: string; keep: { id: string; name: string }; others: { id: string; name: string }[] }) {
  const router = useRouter()
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (hidden) return null
  return <div role="status" className="panel mb-6 space-y-3 border-link p-4 text-sm">
    <p className="text-ink"><strong>{cleanDestination(keep.name)}</strong> and {others.map((other, index) => <span key={other.id}>{index > 0 && ' and '}<strong>{cleanDestination(other.name)}</strong></span>)} look like the same place.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try {
          for (const other of others) { const result = await mergePlanDestination(tripId, other.id, keep.id); if (result.error) { setError(result.error); return } }
          router.refresh()
        } catch { setError('Could not merge them. Please try again.') } finally { setBusy(false) }
      }} className="btn btn-primary btn-sm">{busy ? 'Merging…' : `Merge into ${cleanDestination(keep.name)}`}</button>
      <button type="button" disabled={busy} onClick={() => setHidden(true)} className="btn btn-outline btn-sm">They’re different</button>
    </div>
    {error && <p role="alert" className="text-danger">{error}</p>}
  </div>
}

// A destination heading's Edit panel: change the destination, move all its places into another one (which
// removes it), or remove it. Removing one that has places asks first and says how many go with it.
function DestinationEditor({ tripId, destination, places, others, onClose }: { tripId: string; destination: { id: string; name: string }; places: number; others: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState(destination.name)
  const [moveTo, setMoveTo] = useState<{ id: string; name: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const placesLabel = `${places} ${places === 1 ? 'place' : 'places'}`
  async function run(action: () => Promise<{ error?: string }>) {
    setBusy(true); setError('')
    try { const result = await action(); if (result.error) setError(result.error); else { onClose(); router.refresh() } }
    catch { setError('Could not save. Please try again.') } finally { setBusy(false) }
  }
  return <div className="panel mb-5 space-y-5 p-4">
    <fieldset disabled={busy} className="space-y-5">
      <div className="space-y-2"><p className="text-sm font-semibold text-ink">Change destination</p>
        <PlacesAutocomplete maxLength={160} value={name} onChange={setName} onSelect={(main, secondary) => setName(cleanDestination([main, secondary].filter(Boolean).join(', ')))} type="destination" placeholder="City or area" aria-label="Destination" className={inputClass} />
        <button type="button" disabled={!name.trim() || name.trim() === destination.name} onClick={() => void run(() => renamePlanDestination(tripId, destination.id, name))} className="btn btn-primary btn-sm">Save</button>
        {places > 0 && <p className="text-xs text-muted">Its {placesLabel} stay with it.</p>}</div>
      {places > 0 && others.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold text-ink">Move its places to…</p>
        <div className="flex flex-wrap gap-1.5">{others.map(other => <button key={other.id} type="button" aria-pressed={moveTo?.id === other.id} onClick={() => setMoveTo(current => current?.id === other.id ? null : other)} className="chip">{cleanDestination(other.name)}</button>)}</div>
        {moveTo && <button type="button" onClick={() => void run(() => mergePlanDestination(tripId, destination.id, moveTo.id))} className="btn btn-primary btn-sm">Move {placesLabel} to {cleanDestination(moveTo.name)} and remove {cleanDestination(destination.name)}</button>}</div>}
      {others.length > 0 && <div className="space-y-2 border-t border-line-soft pt-4">
        {!confirmRemove ? <button type="button" onClick={() => places ? setConfirmRemove(true) : void run(() => removePlanDestination(tripId, destination.id))} className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger"><Trash2 size={16} />Remove destination</button>
        : <><p className="text-sm text-ink">Remove {cleanDestination(destination.name)} and its {placesLabel}? Their notes, ratings and photos go too. This can’t be undone.{others.length > 0 && ' To keep them, move them to another destination above instead.'}</p>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void run(() => removePlanDestination(tripId, destination.id, true))} className="btn btn-danger btn-sm">Remove destination and {placesLabel}</button><button type="button" onClick={() => setConfirmRemove(false)} className="btn btn-outline btn-sm">Keep it</button></div></>}
      </div>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <button type="button" onClick={onClose} className="text-sm text-link">Done</button>
  </div>
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "When to go": the months the poster recommends, shown on the posted trip.
function MonthPicker({ value, onChange, legendClass = 'mb-1 text-sm' }: { value: string[]; onChange: (months: string[]) => void; legendClass?: string }) {
  return <fieldset><legend className={legendClass}>When to go (optional)</legend><p className="mb-2 text-xs text-muted">Which months would you recommend? Select all that apply.</p><div className="grid grid-cols-6 gap-1.5">{MONTHS.map(month => <button key={month} type="button" aria-pressed={value.includes(month)} onClick={() => onChange(value.includes(month) ? value.filter(item => item !== month) : [...value, month])} className="chip justify-center !px-0">{month}</button>)}</div></fieldset>
}
function DetailsForm({ trip }: { trip: Trip }) {
  const router = useRouter()
  const coverPhotos = tripPhotoList(trip)
  const [cover, setCover] = useState<string | null>(trip.coverPhoto ?? coverPhotos[0] ?? null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverMessage, setCoverMessage] = useState('')
  const [months, setMonths] = useState<string[]>(trip.bestMonths ?? [])
  const [audience, setAudience] = useState(trip.audience ?? '')
  const stops = trip.destinations.filter(destination => destination.name !== 'Destination to decide')
  const [stopDays, setStopDays] = useState<Record<string, string>>(Object.fromEntries(stops.map(stop => [stop.id, stop.days ? String(stop.days) : ''])))
  const [length, setLength] = useState(trip.durationDays ? String(trip.durationDays) : '')
  // The trip grows to fit the days given to its destinations.
  function setStopDay(id: string, value: string) {
    const next = { ...stopDays, [id]: value }
    setStopDays(next)
    const total = Object.values(next).reduce((sum, days) => sum + (Number(days) || 0), 0)
    if (total > (Number(length) || 0)) setLength(String(total))
  }
  const [budget, setBudget] = useState(trip.budget ?? 0)
  const [tripRating, setTripRating] = useState(trip.tripRating ?? 0)
  // Retired tags show as the tag they now count as (Hiking → Nature), so saving keeps them.
  const [tags, setTags] = useState<string[]>([...new Set((trip.tags ?? []).map(tag => tagMeta(tag)?.id ?? tag).filter(tag => tag !== 'day-trip'))])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  return <><form className="panel space-y-3 p-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return
    setBusy(true); setMessage('')
    const data = new FormData(event.currentTarget)
    try { const result = await savePlanDetails(trip.id, data); setMessage(result.error || 'Saved'); if (!result.error) router.refresh() }
    catch { setMessage('Could not save. Please try again.') } finally { setBusy(false) }
  }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Trip name<input name="title" required defaultValue={trip.title} maxLength={160} className={inputClass} /></label><label className="block text-sm">Number of days (optional)<input name="durationDays" type="number" min="1" step="1" value={length} onChange={event => setLength(event.target.value)} className={inputClass} /></label>{stops.length > 0 && <fieldset><legend className="mb-1 text-sm">Days in each destination (optional)</legend><p className="mb-2 text-xs text-muted">The itinerary sets those days aside for each stop, in order.</p><div className="space-y-2">{stops.map(stop => <label key={stop.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 break-words">{stop.name}</span><input type="number" min="1" max="365" step="1" inputMode="numeric" aria-label={`Days in ${stop.name}`} value={stopDays[stop.id] ?? ''} onChange={event => setStopDay(stop.id, event.target.value)} placeholder="–" className="field w-20 shrink-0" /></label>)}</div><input type="hidden" name="destinationDays" value={JSON.stringify(stopDays)} /></fieldset>}<fieldset><legend className="mb-2 text-sm">Who is this trip for?</legend><input type="hidden" name="audience" value={audience} /><div className="flex flex-wrap gap-2">{([{ value: 'family', label: 'Family' }, { value: 'friends', label: 'Friends' }, { value: 'romantic', label: 'Couples' }, { value: 'adult', label: 'Adults' }] as const).map(option => <button key={option.value} type="button" aria-pressed={audience === option.value} onClick={() => setAudience(option.value)} className="chip">{option.label}</button>)}</div></fieldset><DateFields start={trip.start} end={trip.end} /><p className="text-xs text-muted">Leave both dates blank to keep things flexible.</p><TripExtras budget={budget} onBudget={setBudget} rating={tripRating} onRating={setTripRating} tags={tags} onTags={setTags} legendClass="mb-2 text-sm" months={<MonthPicker value={months} onChange={setMonths} />} /><input type="hidden" name="bestMonths" value={JSON.stringify(months)} /><input type="hidden" name="budget" value={budget} /><input type="hidden" name="tripRating" value={tripRating} /><input type="hidden" name="tags" value={JSON.stringify(tags)} /><label className="block text-sm">Trip notes & tips (optional)<textarea name="notes" rows={4} defaultValue={trip.notes ?? ''} maxLength={8000} placeholder="Tips, packing list, visa info…" className={inputClass} /></label><button className={buttonClass}>{busy ? 'Saving…' : 'Save details'}</button></fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form>
    {coverPhotos.length > 0 && <div className="panel mt-3 p-4"><p className="text-sm font-semibold text-ink">Cover photo</p><p className="mb-1 text-xs text-muted">Tap a photo to make it the cover. {coverMessage}</p><CoverPhotoPicker photos={coverPhotos} value={cover} disabled={coverBusy} onChange={async url => { const previous = cover; setCover(url); setCoverBusy(true); setCoverMessage(''); try { const result = await setTripCover(trip.id, url); if (result.error) { setCover(previous); setCoverMessage(result.error) } else { setCoverMessage('Saved.'); router.refresh() } } catch { setCover(previous); setCoverMessage('Could not save. Please try again.') } finally { setCoverBusy(false) } }} /></div>}</>
}

// Itinerary tab: how many days the trip is, so places can be put on days.
function TripDaysPrompt({ tripId, current, onDone }: { tripId: string; current?: number; onDone?: () => void }) {
  const router = useRouter()
  const [days, setDays] = useState(current ? String(current) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="panel mb-5 p-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { const result = await setPlanDays(tripId, Number(days)); if (result.error) setError(result.error); else { onDone?.(); router.refresh() } }
    catch { setError('Could not save. Please try again.') } finally { setBusy(false) }
  }}>
    <label className="block text-sm font-semibold text-ink">How many days is your trip?
      <span className="mt-0.5 block text-xs font-normal text-muted">Then give each place a day.</span>
      <span className="mt-2 flex items-center gap-2"><input type="number" inputMode="numeric" min={1} max={365} step={1} required value={days} onChange={event => setDays(event.target.value)} placeholder="e.g. 5" className="field max-w-32" />
      <button disabled={busy} className={buttonClass}>{busy ? 'Saving…' : 'Set days'}</button></span>
    </label>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </form>
}

// Itinerary tab: a dotted "+ Add a day" after the last day, which makes the trip one day longer.
// "When does the trip start?" under the Days / Dates switch; the end date follows from the trip's length.
function StartDateForm({ tripId, initial = '', onDone }: { tripId: string; initial?: string; onDone: () => void }) {
  const router = useRouter()
  const [start, setStart] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="panel mb-5 flex flex-wrap items-end gap-3 p-4" onSubmit={async event => {
    event.preventDefault(); if (!start || busy) return
    setBusy(true); setError('')
    try { const result = await setPlanStartDate(tripId, start); if (result.error) setError(result.error); else { router.refresh(); onDone() } }
    catch { setError('Could not save. Please try again.') } finally { setBusy(false) }
  }}>
    <label className="min-w-0 flex-1"><span className="type-label">{initial ? 'Start date' : 'When does the trip start?'}</span><input type="date" required value={start} onChange={event => setStart(event.target.value)} className={inputClass} /></label>
    <button className="btn btn-primary" disabled={!start || busy}>{busy ? 'Saving…' : initial ? 'Save' : 'Use dates'}</button>
    {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
  </form>
}

function AddDay({ tripId, days }: { tripId: string; days: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <div className="mb-8">
    <button type="button" disabled={busy || days >= 365} onClick={async () => {
      setBusy(true); setError('')
      try { const result = await setPlanDays(tripId, days + 1); if (result.error) setError(result.error); else router.refresh() }
      catch { setError('Could not add a day. Please try again.') } finally { setBusy(false) }
    }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mist-edge text-sm font-semibold text-link hover:bg-mist disabled:opacity-50"><Plus size={18} />{busy ? 'Adding…' : 'Add a day'}</button>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>
}

// Under each day: delete it. Its places move to Unscheduled and later days move up.
function DeleteDay({ tripId, day, places }: { tripId: string; day: number; places: number }) {
  const dayName = useContext(DayNames)
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function remove() {
    setBusy(true); setError('')
    try { const result = await deletePlanDay(tripId, day); if (result.error) setError(result.error); else { setConfirming(false); router.refresh() } }
    catch { setError('Could not delete this day. Please try again.') } finally { setBusy(false) }
  }
  return <div className="mt-2 text-right text-xs">
    {!confirming ? <button type="button" onClick={() => places ? setConfirming(true) : void remove()} disabled={busy} className="min-h-9 text-danger hover:underline disabled:opacity-50">{busy ? 'Deleting…' : `Delete ${dayName(day)}`}</button>
    : <span className="inline-flex flex-wrap items-center justify-end gap-3 text-ink">Delete {dayName(day)}? Its {places === 1 ? 'place moves' : `${places} places move`} to Unscheduled.
      <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-9 font-semibold text-danger">{busy ? 'Deleting…' : 'Delete'}</button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-9">Keep</button></span>}
    {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
  </div>
}

// On an unscheduled place in a day-by-day trip: one tap puts it on a day. "+" adds a new day for it.
// range: the days set aside for this place's destination; those chips are outlined and named above the row.
function DayChips({ itemId, days, range, destination }: { itemId: string; days: number; range?: DayRange; destination?: string }) {
  const dayName = useContext(DayNames)
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  async function move(day: number) {
    setBusy(day); setError('')
    try { const result = await setPlaceDay(itemId, day); if (result.error) setError(result.error); else router.refresh() }
    catch { setError('Could not move this place. Please try again.') } finally { setBusy(null) }
  }
  return <div className="border-t border-line-soft px-3 py-2.5">
    <p className="mb-1.5 text-label font-semibold uppercase tracking-label text-muted">Add to a day{range && destination && <span className="ml-1 normal-case tracking-normal text-link">· {destination}: day{range.start === range.end ? ` ${range.start}` : `s ${range.start}–${range.end}`}</span>}</p>
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: days }, (_, index) => index + 1).map(day => <button key={day} type="button" disabled={busy !== null} onClick={() => void move(day)} aria-label={`Move to day ${day}`} className={`chip min-w-12 justify-center font-semibold ${range && day >= range.start && day <= range.end ? "!border-link" : ""} disabled:opacity-50`}>{busy === day ? '…' : dayName(day)}</button>)}
      <button type="button" disabled={busy !== null || days >= 365} onClick={() => void move(days + 1)} aria-label={`Add day ${days + 1} for this place`} title="New day" className="flex min-h-9 min-w-9 items-center justify-center rounded-full border border-dashed border-mist-edge text-link hover:bg-mist disabled:opacity-50">{busy === days + 1 ? '…' : <Plus size={16} />}</button>
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
  </div>
}

// Itinerary tab: ask the AI to put the unscheduled places on days, review its plan, then apply it.
function OrganizeWithAI({ tripId, places }: { tripId: string; places: (Place & { destination: string })[] }) {
  const dayName = useContext(DayNames)
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'thinking' | 'review' | 'applying'>('idle')
  const [plan, setPlan] = useState<{ assignments: { id: string; day: number }[]; days: { day: number; theme: string; why: string }[] } | null>(null)
  const [error, setError] = useState('')
  const name = (id: string) => places.find(place => place.id === id)?.name ?? ''
  async function organize() {
    setState('thinking'); setError('')
    try {
      const response = await fetch(`/api/plan/${tripId}/organize`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Something went wrong.')
      if (!data.assignments.length) throw new Error('Postcard couldn’t find a good day for these places. Try the day buttons instead.')
      setPlan(data); setState('review')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Something went wrong.'); setState('idle') }
  }
  async function apply() {
    if (!plan) return
    setState('applying'); setError('')
    try { const result = await applyDayPlan(tripId, plan.assignments); if (result.error) { setError(result.error); setState('review') } else { setPlan(null); setState('idle'); router.refresh() } }
    catch { setError('Could not apply the plan. Please try again.'); setState('review') }
  }
  const byDay = plan ? [...new Set(plan.assignments.map(a => a.day))].sort((a, b) => a - b) : []
  return <div className="mb-4">
    {state !== 'review' && state !== 'applying' ? <button type="button" disabled={state === 'thinking'} onClick={() => void organize()} className="btn btn-outline w-full bg-mist hover:bg-mist-strong"><Sparkles size={16} />{state === 'thinking' ? 'Organizing your days…' : 'Organize with AI'}</button>
    : plan && <div className="panel p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles size={16} />Suggested days</p>
      <p className="mt-1 text-xs text-muted">Nothing moves until you apply. You can change any day afterwards.</p>
      <div className="mt-3 space-y-3">{byDay.map(day => { const theme = plan.days.find(d => d.day === day); return <section key={day} className="rounded-xl bg-paper p-3">
        <h3 className="type-label text-ink normal-case">{dayName(day)}{theme ? ` · ${theme.theme}` : ''}</h3>
        {theme?.why && <p className="mt-0.5 text-xs text-muted">{theme.why}</p>}
        <ul className="mt-1.5 list-disc pl-5 text-sm text-ink-soft">{plan.assignments.filter(a => a.day === day).map(a => <li key={a.id}>{name(a.id)}</li>)}</ul>
      </section> })}</div>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={state === 'applying'} onClick={() => void apply()} className={`${buttonClass} flex-1`}>{state === 'applying' ? 'Applying…' : 'Apply these days'}</button>
        <button type="button" disabled={state === 'applying'} onClick={() => { setPlan(null); setState('idle') }} className="btn btn-outline">Cancel</button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>
}

// All of a trip's photos for choosing a cover: trip photos, then each place's, once each.
function tripPhotoList(trip: Trip) {
  return [...new Set([...(trip.tripPhotos ?? []), ...trip.destinations.flatMap(d => d.items.flatMap(item => item.photos))])]
}
