'use client'

import BackButton from '@/components/BackButton'
import RatingStars from '@/components/RatingStars'

import Link from 'next/link'
import Image from 'next/image'
import styles from '../../itinerary/[id]/places.module.css'
import planningStyles from './Planner.module.css'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MapPin, LockKeyhole, Check, Hotel, Utensils, Camera, Plane, Upload, Pencil, Sparkles, Users } from 'lucide-react'
import { addPlanPlace, editPlanPlace, savePlanDetails, removePlanPlace, savePublishDetails, setPlanDays, deletePlanDay, setPlaceDay, applyDayPlan } from '@/actions/planning'
import PlanImport from '@/components/PlanImport'
import PlaceEntryForm from '@/components/PlaceEntryForm'
import PlaceEditForm, { type PlaceEditValues, type PlaceType } from '@/components/PlaceEditForm'
import EventPhotoInput from '@/components/EventPhotoInput'
import PlaceQuickEdit from '@/components/PlaceQuickEdit'
import { StarPicker } from '@/components/ui/Stars'
import { updatePlace } from '@/actions/placeQuickEdit'
import DeleteButton from '@/components/DeleteButton'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import PlanningMap from '@/components/PlanningMap'
import PlacePeople from '@/components/PlacePeople'
import PlacePhoto from '@/components/PlacePhoto'
import { DateFields, inputClass, buttonClass } from '../NewPlanForm'
import { TAGS } from '@/lib/tags'
import { getRecommendation } from '@/lib/placeRecommendation'

type Place = { tags: string[]; lat: number | null; lng: number | null; placeId: string | null; id: string; name: string; type: string; notes: string | null; status: string; day: number | null; rating: number | null; photos: string[]; mealType: string | null; alternative: string | null; description: string | null; link: string | null; address: string | null }
type Trip = { notes?: string | null; bestMonths?: string[]; budget?: number | null; tripRating?: number | null; tags?: string[]; postType: string; durationDays?: number | null; id: string; title: string; audience: string; isPlan: boolean; visibility: string; start: string; end: string; destinations: { id: string; name: string; country: string | null; items: Place[] }[] }
const categories = [{ value: 'hotel', label: 'Hotels', eyebrow: 'Stay', Icon: Hotel }, { value: 'food_drink', label: 'Restaurants', eyebrow: 'Food & drink', Icon: Utensils }, { value: 'activity', label: 'Activities', eyebrow: 'Explore', Icon: Camera }, { value: 'transport', label: 'Transportation', eyebrow: 'Getting around', Icon: Plane }]

export default function Planner({ trip, initialImport = false, initialDetails = false, initialPost = false }: { trip: Trip; initialImport?: boolean; initialDetails?: boolean; initialPost?: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<'places' | 'itinerary' | 'map'>('places')
  const [mapOpened, setMapOpened] = useState(false)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(initialImport)
  const [publishing, setPublishing] = useState(false)
  const [publishFormat, setPublishFormat] = useState<'guide' | 'day-trip' | 'itinerary' | null>(initialPost ? (trip.postType === 'guide' ? 'guide' : trip.postType === 'day-trip' ? 'day-trip' : 'itinerary') : null)
  // Prefilled from an earlier Continue, so going back to make changes keeps these choices.
  const [publishBudget, setPublishBudget] = useState(trip.budget ?? 0)
  const [publishRating, setPublishRating] = useState(trip.tripRating ?? 0)
  const [publishTags, setPublishTags] = useState<string[]>((trip.tags ?? []).filter(tag => tag !== 'day-trip'))
  const [publishMonths, setPublishMonths] = useState<string[]>(trip.bestMonths ?? [])
  const [publishMessage, setPublishMessage] = useState('')
  // After Continue: offer to rate places without a rating (not transport or alternatives) before the preview.
  // The places listed when the prompt opened; they stay listed (showing their new stars) as they're rated.
  const [unratedPrompt, setUnratedPrompt] = useState<string[] | null>(null)
  const places = trip.destinations.flatMap(d => d.items.map(item => ({ ...item, destination: [d.name, d.country].filter(Boolean).join(', ') })))
  const scheduled = [...new Set(places.flatMap(p => p.day === null ? [] : [p.day]))].sort((a, b) => a - b)
  const maxDay = Math.max(trip.durationDays ?? 0, ...scheduled, 1)
  const unrated = places.filter(place => place.type !== 'transport' && !place.rating && getRecommendation(place.tags) !== 'option')
  function renderPlace(place: Place & { destination: string }) { return <PlaceRow key={place.id} tripId={trip.id} place={place} maxDay={maxDay} /> }
  function showPreview() { setUnratedPrompt(null); router.push(`/itinerary/${trip.id}?preview=1`) }
  // Continue saves these details on the still-private plan, then shows the trip exactly as it will be posted.
  // Posting happens from that preview.
  async function continueToPreview(format: 'guide' | 'day-trip' | 'itinerary') {
    if (publishing) return
    setPublishing(true); setPublishMessage('')
    try {
      const result = await savePublishDetails(trip.id, format, { budget: publishBudget, tripRating: publishRating, tags: publishTags, bestMonths: publishMonths })
      if (result.error) setPublishMessage(result.error)
      else { setPublishFormat(null); if (unrated.length) setUnratedPrompt(unrated.map(place => place.id)); else showPreview() }
    } catch { setPublishMessage('Could not save these details. Please try again.') }
    finally { setPublishing(false) }
  }
  return <div className="mx-auto max-w-2xl px-4 py-6 text-ink">
    <BackButton fallback="/plan" className="text-sm text-link">← Back</BackButton>
    <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-link"><LockKeyhole size={14} />{trip.visibility === 'draft' ? 'Private plan · Only you' : 'Shared trip'}</div>
    <h1 className="trip-title mt-2 break-words font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">{trip.title}</h1>
    {<details open={initialDetails || undefined} className="mt-3"><summary className="flex cursor-pointer list-none items-center gap-1.5 py-2 text-sm text-link [&::-webkit-details-marker]:hidden"><Pencil size={14} />Edit trip details</summary><DetailsForm key={`${trip.title}:${trip.start}:${trip.end}`} trip={trip} /></details>}
    {trip.visibility !== 'draft' && <div className="mt-4 flex flex-wrap items-center gap-3">
      {<Link href={`/itinerary/${trip.id}`} className="btn btn-outline">View shared trip</Link>}
      <span className="text-xs text-muted">Saved changes appear on your shared trip.</span>
    </div>}
    {/* One row of compact actions, so the places start higher up the screen. */}
    <div className="sticky top-0 z-20 -mx-1 mt-3 grid grid-cols-4 gap-2 bg-paper px-1 py-3">
      <button type="button" onClick={() => { setImporting(false); setAdding(true) }} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-semibold leading-tight border-ink bg-ink text-white"><Plus size={20} />Add a place</button>
      <Link href={`/plan/${trip.id}/friends`} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-semibold leading-tight border-mist-edge bg-card text-link"><Users size={18} />Browse friends’ places</Link>
      <button type="button" onClick={() => { setAdding(false); setImporting(true) }} aria-expanded={importing} aria-controls="plan-import-panel" className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-semibold leading-tight border-mist-edge bg-card text-link"><Upload size={18} />Import notes or files</button>
      {/* This trip's AI chat: it sees the trip's places and can add its picks here. */}
      <Link href={`/testplan?trip=${trip.id}&from=planner`} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-semibold leading-tight border-mist-line bg-mist text-ink"><Sparkles size={18} />Plan with AI</Link>
    </div>
    {adding && <div hidden={importing}><AddPlace trip={trip} maxDay={maxDay} onClose={() => setAdding(false)} /></div>}
    {importing && <div id="plan-import-panel"><PlanImport tripId={trip.id} onClose={() => setImporting(false)} /></div>}
    <div role="tablist" aria-label="Trip view" className="mb-5 mt-3 flex border-b border-line">{(['places', 'itinerary', 'map'] as const).map(value => <button key={value} role="tab" id={`${value}-tab`} aria-controls="trip-panel" aria-selected={tab === value} onClick={() => { setTab(value); if (value === 'map') setMapOpened(true) }} className={`min-h-12 flex-1 border-b-2 p-3 font-semibold ${tab === value ? 'border-link text-link' : 'border-transparent text-muted'}`}>{value === 'places' ? 'Places' : value === 'map' ? 'Map' : 'Itinerary'}</button>)}</div>
    <section role="tabpanel" id="trip-panel" aria-labelledby={`${tab}-tab`}>
      {mapOpened && <div hidden={tab !== 'map'}><PlanningMap places={places.filter(place => place.type !== 'transport' || place.placeId || (place.lat !== null && place.lng !== null)).map(place => ({ id: place.id, name: place.name, city: place.destination, type: place.type === 'hotel' ? 'hotel' : place.type === 'food_drink' ? 'food_drink' : place.type === 'transport' ? 'transport' : 'activity', day: place.day, placeId: place.placeId ?? undefined, lat: place.lat, lng: place.lng }))} /></div>}
      {tab === 'itinerary' && !places.length && (trip.durationDays ? <p className="mb-4 text-sm text-muted">Your {trip.durationDays}-day trip. Add places and choose a day for each.</p> : <TripDaysPrompt tripId={trip.id} />)}
      {tab === 'map' ? null : !places.length ? <div className="rounded-2xl border border-dashed border-line p-8 text-center"><MapPin className="mx-auto mb-3 text-link" /><h2 className="text-xl font-semibold">A place to start</h2><p className="mt-2 text-sm text-muted">A hotel you love, a restaurant someone mentioned, something you want to do. Add it now and decide when later.</p></div> : tab === 'places' ? <>
        <p className="mb-5 text-sm text-muted">Everything you’re considering, all in one place. Days are optional.</p>
        {categories.map(category => { const items = places.filter(p => p.type === category.value); return items.length > 0 && <section key={category.value} className="mb-7"><div className={`${styles.categoryHeading} ${styles[category.value]}`}><h3><span className={styles.categoryIcon}><category.Icon size={17} /></span>{category.label}</h3><span className={styles.count}>{items.length} {items.length === 1 ? 'place' : 'places'}</span></div><div className="space-y-3">{items.map(renderPlace)}</div></section> })}
      </> : <>
        {!trip.durationDays && <TripDaysPrompt tripId={trip.id} />}
        {Array.from({ length: maxDay }, (_, index) => index + 1).filter(day => trip.durationDays || scheduled.includes(day)).map(day => { const dayPlaces = places.filter(p => p.day === day); return <section key={day} className="mb-6"><h2 className="mb-3 text-lg font-semibold">Day {day}</h2>{dayPlaces.length ? <div className="space-y-3">{dayPlaces.map(renderPlace)}</div> : <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">Nothing planned yet.</p>}
          {!!trip.durationDays && trip.durationDays > 1 && <DeleteDay tripId={trip.id} day={day} places={dayPlaces.length} />}</section> })}
        {!!trip.durationDays && <AddDay tripId={trip.id} days={trip.durationDays} />}
        <section><h2 className="mb-3 text-lg font-semibold">Unscheduled</h2>
          {!!trip.durationDays && places.some(p => p.day === null) && <OrganizeWithAI tripId={trip.id} places={places} />}<div className="space-y-3">{places.filter(p => p.day === null).map(place => trip.durationDays ? <PlaceRow key={place.id} tripId={trip.id} place={place} maxDay={maxDay} dayChips={trip.durationDays} /> : renderPlace(place))}</div>{places.every(p => p.day !== null) && <p className="text-sm text-muted">All your places have a day.</p>}</section>
      </>}
    </section>
    <div className="mt-8 border-t border-line pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="pointer-events-auto"><DeleteButton id={trip.id} visibility={trip.visibility} returnTo="/plan" /></div>{trip.visibility === 'draft' && <button type="button" disabled={publishing} onClick={() => setPublishFormat(trip.postType === 'guide' ? 'guide' : trip.postType === 'day-trip' ? 'day-trip' : 'itinerary')} aria-label="Post trip" title="Post trip" className="pointer-events-auto relative inline-flex size-20 items-center justify-center transition-transform hover:-rotate-6 hover:scale-105 disabled:opacity-60"><Image src="/brand/postcard-stamp-logo.png" alt="" width={80} height={80} /><span className="sr-only">Post</span></button>}</div></div>
    {trip.visibility === 'draft' && publishFormat && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-ink/50 px-4 py-6 [grid-template-columns:minmax(0,1fr)]" role="dialog" aria-modal="true" aria-labelledby="publish-format-heading"><div className="panel w-full max-w-md p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 id="publish-format-heading" className="font-[family-name:var(--font-playfair)] text-2xl text-ink">A few more details</h2><p className="mt-1 text-sm text-muted">Add a few details before sharing your trip.</p></div><button type="button" onClick={() => setPublishFormat(null)} className="text-2xl leading-none text-muted" aria-label="Close">×</button></div><div className="mt-5 space-y-5"><fieldset><legend className="mb-2 text-sm font-semibold text-link">Trip type</legend><div className="grid grid-cols-3 gap-2">{([['guide', 'Guide'], ['day-trip', 'Day trip'], ['itinerary', 'Multi-day']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPublishFormat(value)} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${publishFormat === value ? 'border-link bg-mist text-ink' : 'border-line text-muted'}`}>{label}</button>)}</div></fieldset><fieldset><legend className="mb-2 text-sm font-semibold text-link">Budget</legend><div className="flex gap-2">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" onClick={() => setPublishBudget(publishBudget === value ? 0 : value)} className={`text-xl ${value <= publishBudget ? 'text-gold' : 'text-gold-faint'}`} aria-label={`${value} dollar signs`}>$</button>)}</div></fieldset><fieldset><legend className="mb-2 text-sm font-semibold text-link">Overall trip rating</legend><div className="flex gap-1"><StarPicker value={publishRating} onChange={setPublishRating} name="trip" size={26} /></div></fieldset><MonthPicker value={publishMonths} onChange={setPublishMonths} legendClass="mb-1 text-sm font-semibold text-link" /><fieldset><legend className="mb-2 text-sm font-semibold text-link">Tags</legend><div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{TAGS.slice(0, 16).map(tag => <button key={tag.id} type="button" aria-pressed={publishTags.includes(tag.id)} onClick={() => setPublishTags(current => current.includes(tag.id) ? current.filter(value => value !== tag.id) : [...current, tag.id])} className="chip">{tag.label}</button>)}</div></fieldset><button type="button" disabled={publishing} onClick={() => void continueToPreview(publishFormat)} className="btn btn-primary w-full">{publishing ? 'Saving…' : 'Continue →'}</button></div></div></div>}
    {publishMessage && <p role="status" className="mt-2 text-right text-sm text-link">{publishMessage}</p>}
    {unratedPrompt && <UnratedPrompt places={places.filter(place => unratedPrompt.includes(place.id))} onClose={() => setUnratedPrompt(null)} onPreview={showPreview} />}
  </div>
}

function AddPlace({ trip, maxDay, onClose }: { trip: Trip; maxDay: number; onClose: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const clientId = useRef('')
  const [category, setCategory] = useState<'hotel' | 'food_drink' | 'activity' | 'transport'>('hotel')
  const [uploading, setUploading] = useState(false)
  const [day, setDay] = useState('')
  const [status, setStatus] = useState('considering')
  const [destination, setDestination] = useState(trip.destinations[0]?.name === 'Destination to decide' ? '' : trip.destinations[0]?.name ?? '')
  const selectedDestination = trip.destinations.find(d => d.name === destination)
  const city = [destination, selectedDestination?.country].filter(Boolean).join(', ')
  function changeDestination(value: string) { setDestination(value) }

  return <section className="panel mb-4 space-y-3 p-4" aria-label="Add a place"><button type="button" onClick={onClose} className="text-sm text-link">← Back</button><h2 className="font-[family-name:var(--font-playfair)] text-2xl uppercase">Add a place</h2><p className="text-sm text-muted">Save places to your trip. Add notes now. If you’ve already been, add a rating too.</p><fieldset disabled={busy || uploading} className="space-y-3">
    <label className="block text-sm">Destination<PlacesAutocomplete name="destination" required maxLength={160} value={destination} onChange={changeDestination} onSelect={(main, secondary) => changeDestination([main, secondary].filter(Boolean).join(', '))} type="destination" placeholder="City or area" className={inputClass} /></label>
    {trip.destinations.length > 1 && <div className="flex flex-wrap gap-2">{trip.destinations.filter(d => d.name !== 'Destination to decide').map(d => <button type="button" key={d.id} onClick={() => changeDestination(d.name)} className="btn btn-outline">{d.name}</button>)}</div>}
    <fieldset><legend className="mb-2 text-sm">Category</legend><div className="flex flex-wrap gap-2">
      {[
        { value: 'hotel', label: 'Hotel / Airbnb', Icon: Hotel, color: 'peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white' },
        { value: 'food_drink', label: 'Food / Drink', Icon: Utensils, color: 'peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white' },
        { value: 'activity', label: 'Activity', Icon: Camera, color: 'peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white' },
        { value: 'transport', label: 'Transport', Icon: Plane, color: 'peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white' },
      ].map(({ value, label, Icon, color }) => <label key={value} className="cursor-pointer">
        <input type="radio" name="type" value={value} checked={category === value} onChange={() => setCategory(value as 'hotel' | 'food_drink' | 'activity' | 'transport')} className="peer sr-only" />
        <span className={`flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm font-medium text-muted transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-link peer-disabled:opacity-50 ${color}`}><Icon size={16} />{label}</span>
      </label>)}
    </div></fieldset>
    </fieldset>
    <PlaceEntryForm planning type={category} city={city || undefined} onPhotoBusyChange={setUploading} onClose={onClose} onAdd={async item => {
      if (saving.current) return false
      if (!destination.trim()) { setError('Choose a destination first.'); return false }
      saving.current = true; setBusy(true); setError('')
      if (!clientId.current) clientId.current = crypto.randomUUID()
      const data = new FormData()
      for (const [key, value] of Object.entries({ ...item, destination, day, status, clientId: clientId.current })) data.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
      try {
        const result = await addPlanPlace(trip.id, data)
        if (result.error) { setError(result.error); return false }
        router.refresh(); onClose(); return true
      } catch { setError('Could not save. Your place is still here; try again.'); return false }
      finally { saving.current = false; setBusy(false) }
    }}>
      <fieldset><legend className="mb-2 text-xs uppercase tracking-wide text-link">Booking status (optional)</legend><div className="flex flex-wrap gap-2">{[['considering', 'Want to go'], ['booked', 'Booked'], ['visited', 'Visited']].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className="chip">{label}</button>)}</div></fieldset>
      {/* Day-by-day trips ask which day right away; idea lists keep it tucked away. */}
      {trip.durationDays ? <label className="block text-xs uppercase tracking-wide text-link">Which day?<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>Day {value}</option>)}</select></label>
      : <details><summary className="text-sm text-link">Add a day (optional)</summary>
      <label className="block text-sm">Day (optional)<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>Day {value}</option>)}</select></label>
      </details>}
    </PlaceEntryForm>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
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
    <div className="panel w-full max-w-md min-w-0 p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 id="unrated-heading" className="font-[family-name:var(--font-playfair)] text-2xl text-ink">Rate your places?</h2><p className="mt-1 text-sm text-muted">{remaining === 0 ? 'All rated. Thanks!' : remaining === 1 ? 'One place doesn’t have a rating yet.' : `${remaining} places don’t have a rating yet.`} Ratings help friends know what to prioritize.</p></div><button type="button" onClick={onClose} className="shrink-0 text-2xl leading-none text-muted" aria-label="Close">×</button></div>
      <ul className="mt-4 max-h-[50dvh] divide-y divide-line-soft overflow-y-auto">{places.map(place => <li key={place.id} className="min-w-0 py-3">
        <p className="text-sm font-semibold [overflow-wrap:anywhere]">{place.name}</p>
        <p className="text-xs text-muted">{categories.find(category => category.value === place.type)?.eyebrow ?? 'Place'}</p>
        <div className="mt-1 flex items-center"><StarPicker value={ratings[place.id] ?? 0} onChange={value => void rate(place.id, value)} name={place.name} disabled={!!saving} />{saving === place.id ? <span className="ml-2 text-xs text-muted">Saving…</span> : ratings[place.id] ? <span className="ml-2 flex items-center gap-1 text-xs text-link"><Check size={13} />Saved</span> : null}</div>
      </li>)}</ul>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={onPreview} disabled={!!saving} className="btn btn-primary mt-4 w-full">{remaining === 0 ? 'Preview my trip →' : 'Skip, preview my trip →'}</button>
    </div>
  </div>
}

function PlaceRow({ tripId, place, maxDay, dayChips }: { tripId: string; place: Place & { destination: string }; maxDay: number; dayChips?: number }) {
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
  const [type, setType] = useState(place.type)
  const [uploading, setUploading] = useState(false)
  const category = categories.find(category => category.value === place.type) ?? categories[2]
  function openEditor() { setType(place.type); setPlaceId(place.placeId ?? ''); setPhotos(place.photos); setDay(place.day === null ? '' : String(place.day)); setEditing(true); setError(''); setSaved(false) }
  async function save(values: PlaceEditValues) {
    if (saving.current || uploading) return
    saving.current = true; setBusy(true); setError('')
    const data = new FormData()
    for (const [key, value] of Object.entries({ name: values.name, category: type, placeId, status: place.status, notes: values.notes, day, mealType: values.mealType,
      tags: JSON.stringify(values.tags), alternative: values.alternative, description: values.description, link: values.link, address: values.address, photos: JSON.stringify(photos) })) data.set(key, value)
    try { const result = await editPlanPlace(place.id, data); if (result.error) setError(result.error); else { setEditing(false); setSaved(true); router.refresh() } }
    catch { setError('Could not save. Your changes are still here; try again.') }
    finally { saving.current = false; setBusy(false) }
  }
  const Icon = category.Icon
  return <article id={`place-${place.id}`} className={`${planningStyles.place} ${styles[category.value]} scroll-mt-40`}>
      {/* Tapping the photo or text opens the place with its full notes and details. */}
      <div role="button" tabIndex={0} aria-label={`Open ${place.name}`} onClick={() => { if (!editing) openEditor() }} onKeyDown={event => { if (!editing && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openEditor() } }} className={`${styles.card} ${planningStyles.card} cursor-pointer`}>
      <PlacePhoto itemId={place.id} name={place.name} photos={place.photos} thumbnailClass={styles.thumbnail} fallback={<div className={styles.keepsake} aria-hidden="true"><span>{category.eyebrow}</span><Icon size={25} strokeWidth={1} /><span>{place.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span></div>} />
      <div className={styles.cardBody}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={styles.eyebrow}>{category.eyebrow}</p>
          {getRecommendation(place.tags) === 'option' && <span className="rounded-full border border-mist-line bg-mist px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-link">Alternative</span>}
        </div>
        <h3 className={styles.placeName}>{place.name}</h3>
        <p className={planningStyles.location}>{place.destination}</p>
        {!!place.rating && <p className="mt-1"><RatingStars value={place.rating} label={`Your rating: ${place.rating} out of 5`} /></p>}
        {place.notes && <p className={styles.note}>{place.notes}</p>}
        {/* Opens this trip's AI chat with a question about this place ready to finish. */}
        <Link href={`/testplan?trip=${tripId}&ask=${place.id}&from=planner&new=1`} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} className="relative z-[2] mt-2 inline-flex items-center gap-1 text-xs font-semibold text-link underline-offset-2 hover:underline"><Sparkles size={13} />Ask AI about this place</Link>
      </div>
    </div>
    {!!dayChips && <DayChips itemId={place.id} days={dayChips} />}
    {place.type !== 'transport' && <PlacePeople key={`${place.placeId}:${place.name}:${place.destination}`} compact placeId={place.placeId ?? ''} name={place.name} location={place.destination} />}
    <div className={planningStyles.controls}>
    {!editing ? <PlaceQuickEdit compact row itemId={place.id} name={place.name} type={category.value as PlaceType} tags={place.tags} rating={place.rating} photos={place.photos}
        leading={<button onClick={openEditor} type="button" className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs text-link sm:text-sm"><Pencil size={15} />Edit details</button>} />
      : <div className="w-full">
        {/* Same fields as the trip editor, plus photos and the day for this plan. */}
        <PlaceEditForm key={type} type={type as PlaceType} city={place.destination} busy={busy || uploading} saveLabel="Save changes" showRating={false} onPlaceIdChange={setPlaceId} onClose={() => setEditing(false)} onSave={values => void save(values)}
          initial={{ name: place.name, mealType: place.mealType ?? '', rating: place.rating ?? 0, notes: place.notes ?? '', tags: place.tags, isHighlight: false, alternative: place.alternative ?? '', description: place.description ?? '', link: place.link ?? '', address: place.address ?? '' }}>
          <div className="space-y-1"><p className="text-xs text-muted">Photos</p><EventPhotoInput photos={photos} name={place.name} onChange={setPhotos} onBusyChange={setUploading} /></div>
          <fieldset><legend className="mb-1 text-xs text-muted">Category</legend><div className="flex flex-wrap gap-1.5">{categories.map(option => <button key={option.value} type="button" aria-pressed={type === option.value} onClick={() => setType(option.value)} className="chip"><option.Icon size={14} />{option.label}</button>)}</div></fieldset>
          <label className="block text-xs text-muted">Day (optional)<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>Day {value}</option>)}</select></label>
        </PlaceEditForm>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>}
    {saved && <p role="status" className="flex items-center gap-1 text-xs text-link"><Check size={14} />Saved</p>}
    {editing && <div className="w-full">{!removing ? <button type="button" aria-label={`Delete ${place.name}`} className="min-h-11 text-xs text-red-700" onClick={() => setRemoving(true)}>Delete place</button> : <div className="text-sm"><p>Delete this place and its notes? The rest of your trip will stay.</p><button type="button" disabled={busy} className="min-h-11 pr-4 text-red-700" onClick={async () => {
      if (saving.current) return
      saving.current = true; setBusy(true); setError('')
      try { const result = await removePlanPlace(place.id); if (result.error) setError(result.error); else router.refresh() }
      catch { setError('Could not remove. Please try again.') } finally { saving.current = false; setBusy(false) }
    }}>{busy ? 'Deleting…' : 'Delete this place'}</button><button type="button" disabled={busy} className="min-h-11" onClick={() => setRemoving(false)}>Keep place</button></div>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>}
    </div>
  </article>
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "When to go": the months the poster recommends, shown on the posted trip.
function MonthPicker({ value, onChange, legendClass = 'mb-1 text-sm' }: { value: string[]; onChange: (months: string[]) => void; legendClass?: string }) {
  return <fieldset><legend className={legendClass}>When to go (optional)</legend><p className="mb-2 text-xs text-muted">Which months would you recommend? Select all that apply.</p><div className="grid grid-cols-6 gap-1.5">{MONTHS.map(month => <button key={month} type="button" aria-pressed={value.includes(month)} onClick={() => onChange(value.includes(month) ? value.filter(item => item !== month) : [...value, month])} className={`min-h-10 rounded-lg border text-xs font-medium ${value.includes(month) ? 'border-link bg-link text-white' : 'border-line text-muted'}`}>{month}</button>)}</div></fieldset>
}
function DetailsForm({ trip }: { trip: Trip }) {
  const router = useRouter()
  const [months, setMonths] = useState<string[]>(trip.bestMonths ?? [])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  return <form className="space-y-3 rounded-xl border border-line bg-white p-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return
    setBusy(true); setMessage('')
    const data = new FormData(event.currentTarget)
    try { const result = await savePlanDetails(trip.id, data); setMessage(result.error || 'Saved'); if (!result.error) router.refresh() }
    catch { setMessage('Could not save. Please try again.') } finally { setBusy(false) }
  }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Trip name<input name="title" required defaultValue={trip.title} maxLength={160} className={inputClass} /></label><label className="block text-sm">Number of days (optional)<input name="durationDays" type="number" min="1" step="1" defaultValue={trip.durationDays ?? ''} className={inputClass} /></label><fieldset><legend className="mb-2 text-sm">Who is this trip for?</legend><div className="flex flex-wrap gap-2">{([{ value: 'family', label: 'Family' }, { value: 'friends', label: 'Friends' }, { value: 'romantic', label: 'Couples' }, { value: 'adult', label: 'Adults' }] as const).map(option => <label key={option.value} className="cursor-pointer"><input className="peer sr-only" type="radio" name="audience" value={option.value} defaultChecked={trip.audience === option.value} /><span className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm text-link peer-checked:border-link peer-checked:bg-mist peer-checked:font-semibold">{option.label}</span></label>)}</div></fieldset><DateFields start={trip.start} end={trip.end} /><p className="text-xs text-muted">Leave both dates blank to keep things flexible.</p><MonthPicker value={months} onChange={setMonths} /><input type="hidden" name="bestMonths" value={JSON.stringify(months)} /><label className="block text-sm">Trip notes & tips (optional)<textarea name="notes" rows={4} defaultValue={trip.notes ?? ''} maxLength={8000} placeholder="Tips, packing list, visa info…" className={inputClass} /></label><button className={buttonClass}>{busy ? 'Saving…' : 'Save details'}</button></fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form>
}

// Itinerary tab: how many days the trip is, so places can be put on days.
function TripDaysPrompt({ tripId, current, onDone }: { tripId: string; current?: number; onDone?: () => void }) {
  const router = useRouter()
  const [days, setDays] = useState(current ? String(current) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="mb-5 rounded-2xl border border-mist-line bg-mist p-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { const result = await setPlanDays(tripId, Number(days)); if (result.error) setError(result.error); else { onDone?.(); router.refresh() } }
    catch { setError('Could not save. Please try again.') } finally { setBusy(false) }
  }}>
    <label className="block text-sm font-semibold text-ink">How many days is your trip?
      <span className="mt-0.5 block text-xs font-normal text-muted">Then give each place a day.</span>
      <span className="mt-2 flex gap-2"><input type="number" inputMode="numeric" min={1} max={365} step={1} required value={days} onChange={event => setDays(event.target.value)} placeholder="e.g. 5" className={`${inputClass} !mt-0 max-w-32`} />
      <button disabled={busy} className={buttonClass}>{busy ? 'Saving…' : 'Set days'}</button></span>
    </label>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </form>
}

// Itinerary tab: a dotted "+ Add a day" after the last day, which makes the trip one day longer.
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
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}

// Under each day: delete it. Its places move to Unscheduled and later days move up.
function DeleteDay({ tripId, day, places }: { tripId: string; day: number; places: number }) {
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
    {!confirming ? <button type="button" onClick={() => places ? setConfirming(true) : void remove()} disabled={busy} className="min-h-9 text-red-700 hover:underline disabled:opacity-50">{busy ? 'Deleting…' : `Delete day ${day}`}</button>
    : <span className="inline-flex flex-wrap items-center justify-end gap-3 text-ink">Delete Day {day}? Its {places === 1 ? 'place moves' : `${places} places move`} to Unscheduled.
      <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-9 font-semibold text-red-700">{busy ? 'Deleting…' : 'Delete'}</button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-9">Keep</button></span>}
    {error && <p role="alert" className="mt-1 text-red-700">{error}</p>}
  </div>
}

// On an unscheduled place in a day-by-day trip: one tap puts it on a day. "+" adds a new day for it.
function DayChips({ itemId, days }: { itemId: string; days: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  async function move(day: number) {
    setBusy(day); setError('')
    try { const result = await setPlaceDay(itemId, day); if (result.error) setError(result.error); else router.refresh() }
    catch { setError('Could not move this place. Please try again.') } finally { setBusy(null) }
  }
  return <div className="border-t border-line-soft px-3 py-2.5">
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Add to a day</p>
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: days }, (_, index) => index + 1).map(day => <button key={day} type="button" disabled={busy !== null} onClick={() => void move(day)} aria-label={`Move to day ${day}`} className="chip min-w-12 justify-center font-semibold disabled:opacity-50">{busy === day ? '…' : `Day ${day}`}</button>)}
      <button type="button" disabled={busy !== null || days >= 365} onClick={() => void move(days + 1)} aria-label={`Add day ${days + 1} for this place`} title="New day" className="flex min-h-9 min-w-9 items-center justify-center rounded-full border border-dashed border-mist-edge text-link hover:bg-mist disabled:opacity-50">{busy === days + 1 ? '…' : <Plus size={15} />}</button>
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
  </div>
}

// Itinerary tab: ask the AI to put the unscheduled places on days, review its plan, then apply it.
function OrganizeWithAI({ tripId, places }: { tripId: string; places: (Place & { destination: string })[] }) {
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
    {state !== 'review' && state !== 'applying' ? <button type="button" disabled={state === 'thinking'} onClick={() => void organize()} className="btn btn-outline w-full bg-mist hover:bg-mist-strong"><Sparkles size={17} />{state === 'thinking' ? 'Organizing your days…' : 'Organize with AI'}</button>
    : plan && <div className="rounded-2xl border border-mist-line bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles size={16} />Suggested days</p>
      <p className="mt-1 text-xs text-muted">Nothing moves until you apply. You can change any day afterwards.</p>
      <div className="mt-3 space-y-3">{byDay.map(day => { const theme = plan.days.find(d => d.day === day); return <section key={day} className="rounded-xl bg-paper p-3">
        <h3 className="text-sm font-semibold normal-case text-ink">Day {day}{theme ? ` · ${theme.theme}` : ''}</h3>
        {theme?.why && <p className="mt-0.5 text-xs text-muted">{theme.why}</p>}
        <ul className="mt-1.5 list-disc pl-5 text-sm text-ink-soft">{plan.assignments.filter(a => a.day === day).map(a => <li key={a.id}>{name(a.id)}</li>)}</ul>
      </section> })}</div>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={state === 'applying'} onClick={() => void apply()} className={`${buttonClass} flex-1`}>{state === 'applying' ? 'Applying…' : 'Apply these days'}</button>
        <button type="button" disabled={state === 'applying'} onClick={() => { setPlan(null); setState('idle') }} className="btn btn-outline">Cancel</button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}
