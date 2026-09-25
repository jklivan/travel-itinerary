'use client'

import BackButton from '@/components/BackButton'

import Link from 'next/link'
import Image from 'next/image'
import styles from '../../itinerary/[id]/places.module.css'
import planningStyles from './Planner.module.css'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MapPin, LockKeyhole, CalendarDays, Check, Hotel, Utensils, Camera, Plane, Upload } from 'lucide-react'
import { addPlanPlace, editPlanPlace, savePlanDetails, removePlanPlace, sharePlan } from '@/actions/planning'
import PlanImport from '@/components/PlanImport'
import PlaceEntryForm from '@/components/PlaceEntryForm'
import PlaceEditForm, { type PlaceEditValues, type PlaceType } from '@/components/PlaceEditForm'
import EventPhotoInput from '@/components/EventPhotoInput'
import DeleteButton from '@/components/DeleteButton'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import PlanningMap from '@/components/PlanningMap'
import PlacePeople from '@/components/PlacePeople'
import PlacePhoto from '@/components/PlacePhoto'
import { DateFields, inputClass, buttonClass } from '../NewPlanForm'
import { TAGS } from '@/lib/tags'
import { getRecommendation } from '@/lib/placeRecommendation'

type Place = { tags: string[]; lat: number | null; lng: number | null; placeId: string | null; id: string; name: string; type: string; notes: string | null; status: string; day: number | null; rating: number | null; photos: string[]; mealType: string | null; alternative: string | null; description: string | null; link: string | null; address: string | null }
type Trip = { postType: string; durationDays?: number | null; id: string; title: string; audience: string; isPlan: boolean; visibility: string; start: string; end: string; destinations: { id: string; name: string; country: string | null; items: Place[] }[] }
const categories = [{ value: 'hotel', label: 'Hotels', eyebrow: 'Stay', Icon: Hotel }, { value: 'food_drink', label: 'Restaurants', eyebrow: 'Food & drink', Icon: Utensils }, { value: 'activity', label: 'Activities', eyebrow: 'Explore', Icon: Camera }, { value: 'transport', label: 'Transportation', eyebrow: 'Getting around', Icon: Plane }]

export default function Planner({ trip, initialImport = false, initialDetails = false, initialPost = false }: { trip: Trip; initialImport?: boolean; initialDetails?: boolean; initialPost?: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<'places' | 'itinerary' | 'map'>('places')
  const [mapOpened, setMapOpened] = useState(false)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(initialImport)
  const [publishing, setPublishing] = useState(false)
  const [publishFormat, setPublishFormat] = useState<'guide' | 'day-trip' | 'itinerary' | null>(initialPost ? (trip.postType === 'guide' ? 'guide' : trip.postType === 'day-trip' ? 'day-trip' : 'itinerary') : null)
  const [publishBudget, setPublishBudget] = useState(0)
  const [publishRating, setPublishRating] = useState(0)
  const [publishTags, setPublishTags] = useState<string[]>([])
  const [publishMessage, setPublishMessage] = useState('')
  const places = trip.destinations.flatMap(d => d.items.map(item => ({ ...item, destination: [d.name, d.country].filter(Boolean).join(', ') })))
  const scheduled = [...new Set(places.flatMap(p => p.day === null ? [] : [p.day]))].sort((a, b) => a - b)
  const maxDay = Math.max(trip.durationDays ?? 0, ...scheduled, 1)
  function renderPlace(place: Place & { destination: string }) { return <PlaceRow key={place.id} place={place} maxDay={maxDay} /> }
  async function publishTrip(format: 'guide' | 'day-trip' | 'itinerary') {
    if (publishing) return
    setPublishing(true); setPublishMessage('')
    try {
      const result = await sharePlan(trip.id, format, { budget: publishBudget, tripRating: publishRating, tags: publishTags })
      if (result.error) setPublishMessage(result.error)
      else { setPublishFormat(null); router.push(`/?posted=${encodeURIComponent(trip.id)}`) }
    } catch { setPublishMessage('Could not publish your itinerary. Please try again.') }
    finally { setPublishing(false) }
  }
  return <div className="mx-auto max-w-2xl px-4 py-6 text-[#2e4147]">
    <BackButton fallback="/plan" className="text-sm text-[#59694f]">← Back</BackButton>
    <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#59694f]"><LockKeyhole size={14} />{trip.visibility === 'draft' ? 'Private plan · Only you' : 'Shared trip'}</div>
    <h1 className="trip-title mt-2 break-words font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">{trip.title}</h1>
    <p className="mt-2 flex items-center gap-2 text-sm text-[#73786d]"><CalendarDays size={16} />{trip.start ? `${trip.start} — ${trip.end}` : 'Dates are flexible'} · {places.length} places</p>
    {trip.isPlan && <details open={initialDetails || undefined} className="mt-3"><summary className="cursor-pointer py-2 text-sm text-[#59694f]">Edit trip name & dates</summary><DetailsForm key={`${trip.title}:${trip.start}:${trip.end}`} trip={trip} /></details>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {!(trip.visibility === 'draft' && trip.isPlan) && <Link href={trip.visibility === 'draft' ? `/itinerary/${trip.id}/edit` : `/itinerary/${trip.id}`} className="min-h-11 rounded-xl border border-[#d7cebc] px-4 py-3 text-sm">{trip.visibility === 'draft' ? 'Edit & publish' : 'View shared trip'}</Link>}
      {trip.visibility !== 'draft' && <span className="text-xs text-[#73786d]">Saved changes appear on your shared trip.</span>}
    </div>
    <div className="sticky top-0 z-20 -mx-1 mt-5 space-y-2 bg-[#f3eee5] px-1 py-3">
      {!adding && !importing && <>
      <button className={`${buttonClass} flex w-full items-center justify-center gap-2`} onClick={() => setAdding(true)}><Plus size={20} />Add a place</button>
      {trip.isPlan && <Link href={`/plan/${trip.id}/friends`} className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-[#8caaa3] bg-[#fffdf7] px-4 py-2 text-sm font-semibold text-[#59694f]">Browse friends’ places · Add several at once</Link>}
      </>}
      <button type="button" onClick={() => setImporting(true)} disabled={importing} aria-expanded={importing} aria-controls="plan-import-panel" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#8caaa3] bg-[#fffdf7] px-4 py-2 text-sm font-semibold text-[#59694f] disabled:opacity-60"><Upload size={17} />Import notes or files</button>
    </div>
    {adding && <div hidden={importing}><AddPlace trip={trip} maxDay={maxDay} onClose={() => setAdding(false)} /></div>}
    {importing && <div id="plan-import-panel"><PlanImport tripId={trip.id} onClose={() => setImporting(false)} /></div>}
    <div role="tablist" aria-label="Trip view" className="mb-5 mt-3 flex border-b border-[#d7cebc]">{(['places', 'itinerary', 'map'] as const).map(value => <button key={value} role="tab" id={`${value}-tab`} aria-controls="trip-panel" aria-selected={tab === value} onClick={() => { setTab(value); if (value === 'map') setMapOpened(true) }} className={`min-h-12 flex-1 border-b-2 p-3 font-semibold ${tab === value ? 'border-[#59694f] text-[#59694f]' : 'border-transparent text-[#73786d]'}`}>{value === 'places' ? 'Places' : value === 'map' ? 'Map' : 'Itinerary'}</button>)}</div>
    <section role="tabpanel" id="trip-panel" aria-labelledby={`${tab}-tab`}>
      {mapOpened && <div hidden={tab !== 'map'}><PlanningMap places={places.filter(place => place.type !== 'transport' || place.placeId || (place.lat !== null && place.lng !== null)).map(place => ({ id: place.id, name: place.name, city: place.destination, type: place.type === 'hotel' ? 'hotel' : place.type === 'food_drink' ? 'food_drink' : place.type === 'transport' ? 'transport' : 'activity', day: place.day, placeId: place.placeId ?? undefined, lat: place.lat, lng: place.lng }))} /></div>}
      {tab === 'map' ? null : !places.length ? <div className="rounded-2xl border border-dashed border-[#c4b99e] p-8 text-center"><MapPin className="mx-auto mb-3 text-[#59694f]" /><h2 className="text-xl font-semibold">A place to start</h2><p className="mt-2 text-sm text-[#73786d]">A hotel you love, a restaurant someone mentioned, something you want to do. Add it now and decide when later.</p></div> : tab === 'places' ? <>
        <p className="mb-5 text-sm text-[#73786d]">Everything you’re considering, all in one place. Days are optional.</p>
        {categories.map(category => { const items = places.filter(p => p.type === category.value); return items.length > 0 && <section key={category.value} className="mb-7"><div className={`${styles.categoryHeading} ${styles[category.value]}`}><h3><span className={styles.categoryIcon}><category.Icon size={17} /></span>{category.label}</h3><span className={styles.count}>{items.length} {items.length === 1 ? 'place' : 'places'}</span></div><div className="space-y-3">{items.map(renderPlace)}</div></section> })}
      </> : <>
        <p className="mb-5 text-sm text-[#73786d]">Your places, day by day. Places without a day are listed under “Unscheduled”—give them one with Edit details whenever you’re ready.</p>
        {scheduled.map(day => <section key={day} className="mb-6"><h2 className="mb-3 text-lg font-semibold">Day {day}</h2><div className="space-y-3">{places.filter(p => p.day === day).map(renderPlace)}</div></section>)}
        <section><h2 className="mb-3 text-lg font-semibold">Unscheduled</h2><div className="space-y-3">{places.filter(p => p.day === null).map(renderPlace)}</div>{places.every(p => p.day !== null) && <p className="text-sm text-[#73786d]">All your places have a day.</p>}</section>
      </>}
    </section>
    <div className="mt-8 border-t border-[#d7cebc] pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="pointer-events-auto"><DeleteButton id={trip.id} visibility={trip.visibility} returnTo="/plan" /></div>{trip.isPlan && trip.visibility === 'draft' && <button type="button" disabled={publishing} onClick={() => setPublishFormat(trip.postType === 'guide' ? 'guide' : trip.postType === 'day-trip' ? 'day-trip' : 'itinerary')} aria-label="Post trip" title="Post trip" className="pointer-events-auto relative inline-flex h-16 w-24 items-center justify-center bg-[#355650] text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60 [clip-path:polygon(7%_0,93%_0,100%_10%,100%_90%,93%_100%,7%_100%,0_90%,0_10%)]"><span className="flex h-12 w-20 items-center justify-center border-2 border-dashed border-[#355650] bg-[#f1e7d8]"><Image src="/brand/postcard-icon.svg" alt="" width={42} height={42} /></span><span className="sr-only">Post</span></button>}</div></div>
    {trip.isPlan && trip.visibility === 'draft' && publishFormat && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#242e25]/50 px-5 py-6" role="dialog" aria-modal="true" aria-labelledby="publish-format-heading"><div className="w-full max-w-md rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 id="publish-format-heading" className="font-[family-name:var(--font-playfair)] text-2xl text-[#2e4147]">A few more details</h2><p className="mt-1 text-sm text-[#73786d]">Add a few details before sharing your trip.</p></div><button type="button" onClick={() => setPublishFormat(null)} className="text-2xl leading-none text-[#73786d]" aria-label="Close">×</button></div><div className="mt-5 space-y-5"><fieldset><legend className="mb-2 text-sm font-semibold text-[#59694f]">Trip type</legend><div className="grid grid-cols-3 gap-2">{([['guide', 'Guide'], ['day-trip', 'Day trip'], ['itinerary', 'Multi-day']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPublishFormat(value)} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${publishFormat === value ? 'border-[#59694f] bg-[#e8eee8] text-[#355650]' : 'border-[#d7cebc] text-[#73786d]'}`}>{label}</button>)}</div></fieldset><fieldset><legend className="mb-2 text-sm font-semibold text-[#59694f]">Budget</legend><div className="flex gap-2">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" onClick={() => setPublishBudget(publishBudget === value ? 0 : value)} className={`text-xl ${value <= publishBudget ? 'text-[#a27e3b]' : 'text-[#c3bcad]'}`} aria-label={`${value} dollar signs`}>$</button>)}</div></fieldset><fieldset><legend className="mb-2 text-sm font-semibold text-[#59694f]">Overall trip rating</legend><div className="flex gap-1">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" onClick={() => setPublishRating(publishRating === value ? 0 : value)} className={`text-2xl ${value <= publishRating ? 'text-[#a27e3b]' : 'text-[#c3bcad]'}`} aria-label={`Rate trip ${value} out of 5`}>★</button>)}</div></fieldset><fieldset><legend className="mb-2 text-sm font-semibold text-[#59694f]">Tags</legend><div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{TAGS.slice(0, 16).map(tag => <button key={tag.id} type="button" onClick={() => setPublishTags(current => current.includes(tag.id) ? current.filter(value => value !== tag.id) : [...current, tag.id])} className={`rounded-full border px-3 py-1.5 text-xs ${publishTags.includes(tag.id) ? 'border-[#59694f] bg-[#e8eee8] text-[#355650]' : 'border-[#d7cebc] text-[#73786d]'}`}>{tag.label}</button>)}</div></fieldset><button type="button" disabled={publishing} onClick={() => void publishTrip(publishFormat)} className="w-full rounded-xl bg-[#355650] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{publishing ? 'Posting…' : 'Post trip'}</button></div></div></div>}
    {publishMessage && <p role="status" className="mt-2 text-right text-sm text-[#59694f]">{publishMessage}</p>}
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

  return <section className="mb-4 space-y-3 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4" aria-label="Add a place"><button type="button" onClick={onClose} className="text-sm text-[#59694f]">← Back</button><h2 className="font-[family-name:var(--font-playfair)] text-2xl uppercase">Add a place</h2><p className="text-sm text-[#73786d]">Save places to your trip. Add notes now and a rating after your visit.</p><fieldset disabled={busy || uploading} className="space-y-3">
    <label className="block text-sm">Destination<PlacesAutocomplete name="destination" required maxLength={160} value={destination} onChange={changeDestination} onSelect={(main, secondary) => changeDestination([main, secondary].filter(Boolean).join(', '))} type="destination" placeholder="City or area" className={inputClass} /></label>
    {trip.destinations.length > 1 && <div className="flex flex-wrap gap-2">{trip.destinations.filter(d => d.name !== 'Destination to decide').map(d => <button type="button" key={d.id} onClick={() => changeDestination(d.name)} className="min-h-11 rounded-lg border border-[#d7cebc] px-3 text-xs">{d.name}</button>)}</div>}
    <fieldset><legend className="mb-2 text-sm">Category</legend><div className="flex flex-wrap gap-2">
      {[
        { value: 'hotel', label: 'Hotel / Airbnb', Icon: Hotel, color: 'peer-checked:border-[#242e25] peer-checked:bg-[#242e25] peer-checked:text-white' },
        { value: 'food_drink', label: 'Food / Drink', Icon: Utensils, color: 'peer-checked:border-[#242e25] peer-checked:bg-[#242e25] peer-checked:text-white' },
        { value: 'activity', label: 'Activity', Icon: Camera, color: 'peer-checked:border-[#242e25] peer-checked:bg-[#242e25] peer-checked:text-white' },
        { value: 'transport', label: 'Transport', Icon: Plane, color: 'peer-checked:border-[#242e25] peer-checked:bg-[#242e25] peer-checked:text-white' },
      ].map(({ value, label, Icon, color }) => <label key={value} className="cursor-pointer">
        <input type="radio" name="type" value={value} checked={category === value} onChange={() => setCategory(value as 'hotel' | 'food_drink' | 'activity' | 'transport')} className="peer sr-only" />
        <span className={`flex min-h-11 items-center gap-2 rounded-full border border-[#d7cebc] bg-white px-3 py-2 text-sm font-medium text-[#73786d] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#59694f] peer-disabled:opacity-50 ${color}`}><Icon size={16} />{label}</span>
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
      <fieldset><legend className="mb-2 text-xs uppercase tracking-wide text-[#59694f]">Place status (optional)</legend><div className="flex flex-wrap gap-2">{[['considering', 'Want to go'], ['booked', 'Booked'], ['visited', 'Visited']].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-10 rounded-full border px-3 text-xs ${status === value ? 'border-[#59694f] bg-[#e8eee8] text-[#355650]' : 'border-[#d7cebc] text-[#73786d]'}`}>{label}</button>)}</div></fieldset>
      <details><summary className="text-sm text-[#59694f]">Add a day (optional)</summary>
      <label className="block text-sm">Day (optional)<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>Day {value}</option>)}</select></label>
      </details>
    </PlaceEntryForm>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>
}

function PlaceRow({ place, maxDay }: { place: Place & { destination: string }; maxDay: number }) {
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
  const [uploading, setUploading] = useState(false)
  const category = categories.find(category => category.value === place.type) ?? categories[2]
  async function save(values: PlaceEditValues) {
    if (saving.current || uploading) return
    saving.current = true; setBusy(true); setError('')
    const data = new FormData()
    for (const [key, value] of Object.entries({ name: values.name, placeId, status: place.status, rating: String(values.rating), notes: values.notes, day, mealType: values.mealType,
      tags: JSON.stringify(values.tags), alternative: values.alternative, description: values.description, link: values.link, address: values.address, photos: JSON.stringify(photos) })) data.set(key, value)
    try { const result = await editPlanPlace(place.id, data); if (result.error) setError(result.error); else { setEditing(false); setSaved(true); router.refresh() } }
    catch { setError('Could not save. Your changes are still here; try again.') }
    finally { saving.current = false; setBusy(false) }
  }
  const Icon = category.Icon
  return <article className={`${planningStyles.place} ${styles[category.value]}`}>
      <div className={`${styles.card} ${planningStyles.card}`}>
      <PlacePhoto itemId={place.id} name={place.name} photos={place.photos} thumbnailClass={styles.thumbnail} fallback={<div className={styles.keepsake} aria-hidden="true"><span>{category.eyebrow}</span><Icon size={25} strokeWidth={1} /><span>{place.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span></div>} />
      <div className={styles.cardBody}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={styles.eyebrow}>{category.eyebrow}</p>
          {getRecommendation(place.tags) === 'option' && <span className="rounded-full border border-[#b7bea8] bg-[#edf1e9] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#59694f]">Alternative</span>}
        </div>
        <h3 className={styles.placeName}>{place.name}</h3>
        <p className={planningStyles.location}>{place.destination}</p>
        {!!place.rating && <p className="text-sm text-[#a27e3b]" aria-label={`Your rating: ${place.rating} out of 5`}>{'★'.repeat(place.rating)}{'☆'.repeat(5 - place.rating)}</p>}
        {place.notes && <p className={styles.note}>{place.notes}</p>}
      </div>
    </div>
    {place.type !== 'transport' && <PlacePeople key={`${place.placeId}:${place.name}:${place.destination}`} compact placeId={place.placeId ?? ''} name={place.name} location={place.destination} />}
    <div className={planningStyles.controls}>
    {!editing ? <button onClick={() => { setPlaceId(place.placeId ?? ''); setPhotos(place.photos); setDay(place.day === null ? '' : String(place.day)); setEditing(true); setError(''); setSaved(false) }} type="button" className="min-h-11 text-sm font-semibold text-[#59694f]">Edit details →</button>
      : <div className="w-full">
        {/* Same fields as the trip editor, plus photos and the day for this plan. */}
        <PlaceEditForm type={category.value as PlaceType} city={place.destination} busy={busy || uploading} saveLabel="Save changes" onPlaceIdChange={setPlaceId} onClose={() => setEditing(false)} onSave={values => void save(values)}
          initial={{ name: place.name, mealType: place.mealType ?? '', rating: place.rating ?? 0, notes: place.notes ?? '', tags: place.tags, isHighlight: false, alternative: place.alternative ?? '', description: place.description ?? '', link: place.link ?? '', address: place.address ?? '' }}>
          <div className="space-y-1"><p className="text-xs text-[#7a7b70]">Photos</p><EventPhotoInput photos={photos} name={place.name} onChange={setPhotos} onBusyChange={setUploading} /></div>
          <label className="block text-xs text-[#7a7b70]">Day (optional)<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>Day {value}</option>)}</select></label>
        </PlaceEditForm>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>}
    {saved && <p role="status" className="flex items-center gap-1 text-xs text-[#59694f]"><Check size={14} />Saved</p>}
    {editing && <div className="w-full">{!removing ? <button type="button" aria-label={`Delete ${place.name}`} className="min-h-11 text-xs text-red-700" onClick={() => setRemoving(true)}>Delete place</button> : <div className="text-sm"><p>Delete this place and its notes? The rest of your trip will stay.</p><button type="button" disabled={busy} className="min-h-11 pr-4 text-red-700" onClick={async () => {
      if (saving.current) return
      saving.current = true; setBusy(true); setError('')
      try { const result = await removePlanPlace(place.id); if (result.error) setError(result.error); else router.refresh() }
      catch { setError('Could not remove. Please try again.') } finally { saving.current = false; setBusy(false) }
    }}>{busy ? 'Deleting…' : 'Delete this place'}</button><button type="button" disabled={busy} className="min-h-11" onClick={() => setRemoving(false)}>Keep place</button></div>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>}
    </div>
  </article>
}
function DetailsForm({ trip }: { trip: Trip }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  return <form className="space-y-3 rounded-xl border border-[#d7cebc] bg-white p-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return
    setBusy(true); setMessage('')
    const data = new FormData(event.currentTarget)
    try { const result = await savePlanDetails(trip.id, data); setMessage(result.error || 'Saved'); if (!result.error) router.refresh() }
    catch { setMessage('Could not save. Please try again.') } finally { setBusy(false) }
  }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Trip name<input name="title" required defaultValue={trip.title} maxLength={160} className={inputClass} /></label><label className="block text-sm">Number of days (optional)<input name="durationDays" type="number" min="1" step="1" defaultValue={trip.durationDays ?? ''} className={inputClass} /></label><fieldset><legend className="mb-2 text-sm">Who is this trip for?</legend><div className="flex flex-wrap gap-2">{([{ value: 'family', label: 'Family' }, { value: 'friends', label: 'Friends' }, { value: 'romantic', label: 'Couples' }, { value: 'adult', label: 'Adults' }] as const).map(option => <label key={option.value} className="cursor-pointer"><input className="peer sr-only" type="radio" name="audience" value={option.value} defaultChecked={trip.audience === option.value} /><span className="inline-flex min-h-10 items-center rounded-full border border-[#d7cebc] px-4 text-sm text-[#59694f] peer-checked:border-[#59694f] peer-checked:bg-[#e8eee8] peer-checked:font-semibold">{option.label}</span></label>)}</div></fieldset><DateFields start={trip.start} end={trip.end} /><p className="text-xs text-[#73786d]">Leave both dates blank to keep things flexible.</p><button className={buttonClass}>{busy ? 'Saving…' : 'Save details'}</button></fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form>
}
