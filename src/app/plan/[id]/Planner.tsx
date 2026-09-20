'use client'

import BackButton from '@/components/BackButton'

import Link from 'next/link'
import Image from 'next/image'
import styles from '../../itinerary/[id]/places.module.css'
import planningStyles from './Planner.module.css'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MapPin, LockKeyhole, CalendarDays, Check, Hotel, Utensils, Camera, Plane } from 'lucide-react'
import { addPlanPlace, editPlanPlace, savePlanDetails, removePlanPlace, sharePlan } from '@/actions/planning'
import PlanImport from '@/components/PlanImport'
import PlaceEntryForm from '@/components/PlaceEntryForm'
import DeleteButton from '@/components/DeleteButton'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import PlanningMap from '@/components/PlanningMap'
import PlacePeople from '@/components/PlacePeople'
import PlaceQuickEdit from '@/components/PlaceQuickEdit'
import { DateFields, inputClass, buttonClass } from '../NewPlanForm'

type Place = { lat: number | null; lng: number | null; placeId: string | null; id: string; name: string; type: string; notes: string | null; status: string; day: number | null; rating: number | null; photos: string[] }
type Trip = { durationDays?: number | null; id: string; title: string; isPlan: boolean; visibility: string; start: string; end: string; destinations: { id: string; name: string; country: string | null; items: Place[] }[] }
const categories = [{ value: 'hotel', label: 'Hotels', eyebrow: 'Stay', Icon: Hotel }, { value: 'food_drink', label: 'Restaurants', eyebrow: 'Food & drink', Icon: Utensils }, { value: 'activity', label: 'Activities', eyebrow: 'Explore', Icon: Camera }, { value: 'transport', label: 'Transportation', eyebrow: 'Getting around', Icon: Plane }]

export default function Planner({ trip, initialImport = false, initialDetails = false, postMode = false }: { trip: Trip; initialImport?: boolean; initialDetails?: boolean; postMode?: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<'places' | 'itinerary' | 'map'>('places')
  const [mapOpened, setMapOpened] = useState(false)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(initialImport)
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState('')
  const places = trip.destinations.flatMap(d => d.items.map(item => ({ ...item, destination: [d.name, d.country].filter(Boolean).join(', ') })))
  const scheduled = [...new Set(places.flatMap(p => p.day === null ? [] : [p.day]))].sort((a, b) => a - b)
  const maxDay = Math.max(trip.durationDays ?? 0, ...scheduled, 1)
  function renderPlace(place: Place & { destination: string }) { return <PlaceRow key={place.id} place={place} maxDay={maxDay} postMode={postMode} /> }
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
    {!adding && !importing && <div className="sticky top-0 z-20 -mx-1 mt-5 bg-[#f3eee5] px-1 py-3">
      <button className={`${buttonClass} flex w-full items-center justify-center gap-2`} onClick={() => setAdding(true)}><Plus size={20} />Add a place</button>
      {trip.isPlan && <Link href={`/plan/${trip.id}/friends`} className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-[#8caaa3] bg-[#fffdf7] px-4 py-2 text-sm font-semibold text-[#59694f]">Browse friends’ places · Add several at once</Link>}
    </div>}
    {adding && <AddPlace trip={trip} maxDay={maxDay} enhanced={postMode} onClose={() => setAdding(false)} />}
    {importing && <PlanImport tripId={trip.id} onClose={() => setImporting(false)} />}
    <div role="tablist" aria-label="Trip view" className="mb-5 mt-3 flex border-b border-[#d7cebc]">{(['places', 'itinerary', 'map'] as const).map(value => <button key={value} role="tab" id={`${value}-tab`} aria-controls="trip-panel" aria-selected={tab === value} onClick={() => { setTab(value); if (value === 'map') setMapOpened(true) }} className={`min-h-12 flex-1 border-b-2 p-3 font-semibold ${tab === value ? 'border-[#59694f] text-[#59694f]' : 'border-transparent text-[#73786d]'}`}>{value === 'places' ? 'Places' : value === 'map' ? 'Map' : 'Itinerary'}</button>)}</div>
    <section role="tabpanel" id="trip-panel" aria-labelledby={`${tab}-tab`}>
      {mapOpened && <div hidden={tab !== 'map'}><PlanningMap places={places.filter(place => place.type !== 'transport' || place.placeId || (place.lat !== null && place.lng !== null)).map(place => ({ id: place.id, name: place.name, city: place.destination, type: place.type === 'hotel' ? 'hotel' : place.type === 'food_drink' ? 'food_drink' : place.type === 'transport' ? 'transport' : 'activity', day: place.day, placeId: place.placeId ?? undefined, lat: place.lat, lng: place.lng }))} /></div>}
      {tab === 'map' ? null : !places.length ? <div className="rounded-2xl border border-dashed border-[#c4b99e] p-8 text-center"><MapPin className="mx-auto mb-3 text-[#59694f]" /><h2 className="text-xl font-semibold">A place to start</h2><p className="mt-2 text-sm text-[#73786d]">A hotel you love, a restaurant someone mentioned, something you want to do. Add it now and decide when later.</p></div> : tab === 'places' ? <>
        <p className="mb-5 text-sm text-[#73786d]">Everything you’re considering, all in one place. Days are optional.</p>
        {categories.map(category => { const items = places.filter(p => p.type === category.value); return items.length > 0 && <section key={category.value} className="mb-7"><div className={`${styles.categoryHeading} ${styles[category.value]}`}><h3><span className={styles.categoryIcon}><category.Icon size={17} /></span>{category.label}</h3><span className={styles.count}>{items.length} {items.length === 1 ? 'place' : 'places'}</span></div><div className="space-y-3">{items.map(renderPlace)}</div></section> })}
      </> : <>
        <p className="mb-5 text-sm text-[#73786d]">Give a place a day whenever you’re ready. Other places remain flexible.</p>
        {scheduled.map(day => <section key={day} className="mb-6"><h2 className="mb-3 text-lg font-semibold">Day {day}</h2><div className="space-y-3">{places.filter(p => p.day === day).map(renderPlace)}</div></section>)}
        <section><h2 className="mb-3 text-lg font-semibold">Other places</h2><div className="space-y-3">{places.filter(p => p.day === null).map(renderPlace)}</div>{places.every(p => p.day !== null) && <p className="text-sm text-[#73786d]">All your places have a day.</p>}</section>
      </>}
    </section>
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#d7cebc] pt-5">
      <DeleteButton id={trip.id} visibility={trip.visibility} returnTo="/plan" />
      {trip.isPlan && trip.visibility === 'draft' && <button type="button" disabled={publishing} onClick={async () => {
        if (publishing) return
        setPublishing(true); setPublishMessage('')
        try {
          const result = await sharePlan(trip.id)
          if (result.error) setPublishMessage(result.error)
          else { setPublishMessage('Your itinerary is now published.'); router.refresh() }
        } catch { setPublishMessage('Could not publish your itinerary. Please try again.') }
        finally { setPublishing(false) }
      }} className="min-h-11 rounded-xl bg-[#355650] px-4 py-3 text-sm font-semibold text-white hover:bg-[#294640] disabled:opacity-60">{publishing ? 'Publishing…' : 'Publish itinerary'}</button>}
    </div>
    {publishMessage && <p role="status" className="mt-2 text-right text-sm text-[#59694f]">{publishMessage}</p>}
  </div>
}

function AddPlace({ trip, maxDay, enhanced, onClose }: { trip: Trip; maxDay: number; enhanced: boolean; onClose: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const clientId = useRef('')
  const [category, setCategory] = useState<'hotel' | 'food_drink' | 'activity' | 'transport'>('hotel')
  const [uploading, setUploading] = useState(false)
  const [day, setDay] = useState('')
  const [destination, setDestination] = useState(trip.destinations[0]?.name === 'Destination to decide' ? '' : trip.destinations[0]?.name ?? '')
  const selectedDestination = trip.destinations.find(d => d.name === destination)
  const city = [destination, selectedDestination?.country].filter(Boolean).join(', ')
  function changeDestination(value: string) { setDestination(value) }

  return <section className="mb-4 space-y-3 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4" aria-label="Add a place"><h2 className="text-lg font-semibold">Add a place</h2><fieldset disabled={busy || uploading} className="space-y-3">
    <label className="block text-sm">Destination<PlacesAutocomplete name="destination" required maxLength={160} value={destination} onChange={changeDestination} onSelect={(main, secondary) => changeDestination([main, secondary].filter(Boolean).join(', '))} type="destination" placeholder="City or area" className={inputClass} /></label>
    {trip.destinations.length > 1 && <div className="flex flex-wrap gap-2">{trip.destinations.filter(d => d.name !== 'Destination to decide').map(d => <button type="button" key={d.id} onClick={() => changeDestination(d.name)} className="min-h-11 rounded-lg border border-[#d7cebc] px-3 text-xs">{d.name}</button>)}</div>}
    <fieldset><legend className="mb-2 text-sm">Category</legend><div className="flex flex-wrap gap-2">
      {[
        { value: 'hotel', label: 'Hotel / Airbnb', Icon: Hotel, color: 'peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700' },
        { value: 'food_drink', label: 'Food / Drink', Icon: Utensils, color: 'peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-checked:text-orange-700' },
        { value: 'activity', label: 'Activity', Icon: Camera, color: 'peer-checked:border-green-600 peer-checked:bg-green-50 peer-checked:text-green-700' },
        { value: 'transport', label: 'Transport', Icon: Plane, color: 'peer-checked:border-[#687e9b] peer-checked:bg-[#edf1f5] peer-checked:text-[#465e7a]' },
      ].map(({ value, label, Icon, color }) => <label key={value} className="cursor-pointer">
        <input type="radio" name="type" value={value} checked={category === value} onChange={() => setCategory(value as 'hotel' | 'food_drink' | 'activity' | 'transport')} className="peer sr-only" />
        <span className={`flex min-h-11 items-center gap-2 rounded-full border border-[#d7cebc] bg-white px-3 py-2 text-sm font-medium text-[#73786d] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#59694f] peer-disabled:opacity-50 ${color}`}><Icon size={16} />{label}</span>
      </label>)}
    </div></fieldset>
    </fieldset>
    <PlaceEntryForm enhanced={enhanced} type={category} city={city || undefined} onPhotoBusyChange={setUploading} onClose={onClose} onAdd={async item => {
      if (saving.current) return false
      if (!destination.trim()) { setError('Choose a destination first.'); return false }
      saving.current = true; setBusy(true); setError('')
      if (!clientId.current) clientId.current = crypto.randomUUID()
      const data = new FormData()
      for (const [key, value] of Object.entries({ ...item, destination, day, clientId: clientId.current })) data.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
      try {
        const result = await addPlanPlace(trip.id, data)
        if (result.error) { setError(result.error); return false }
        router.refresh(); onClose(); return true
      } catch { setError('Could not save. Your place is still here; try again.'); return false }
      finally { saving.current = false; setBusy(false) }
    }}>
      <label className="block text-sm">Day (optional)<select value={day} onChange={event => setDay(event.target.value)} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>Day {value}</option>)}</select></label>
    </PlaceEntryForm>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>
}

function DayField({ day, maxDay }: { day?: number | null; maxDay: number }) {
  return <label className="block text-sm">Day (optional)<select name="day" defaultValue={day ?? ''} className={inputClass}><option value="">Unscheduled</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map(value => <option key={value} value={value}>Day {value}</option>)}</select></label>
}
function PlaceRow({ place, maxDay, postMode }: { place: Place & { destination: string }; maxDay: number; postMode: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [removing, setRemoving] = useState(false)
  const saving = useRef(false)
  const [name, setName] = useState(place.name)
  const [placeId, setPlaceId] = useState(place.placeId ?? '')
  const category = categories.find(category => category.value === place.type) ?? categories[2]
  const Icon = category.Icon
  return <article className={`${planningStyles.place} ${styles[category.value]}`}>
    <div className={`${styles.card} ${planningStyles.card}`}>
      <div className={styles.thumbnail}>
        {postMode && place.photos[0] ? <Image src={place.photos[0]} alt={place.name} fill sizes="132px" className="object-cover" /> : <div className={styles.keepsake} aria-hidden="true"><span>{category.eyebrow}</span><Icon size={25} strokeWidth={1} /><span>{place.name.split(/\s+/).map(word => word[0]).slice(0, 3).join('')}</span></div>}
      </div>
      <div className={styles.cardBody}>
        <p className={styles.eyebrow}>{category.eyebrow}</p>
        <h3 className={styles.placeName}>{place.name}</h3>
        {postMode && !!place.rating && <p className={planningStyles.rating} aria-label={`Your rating: ${place.rating} out of 5`}>{'★'.repeat(place.rating)}<span>Your rating</span></p>}
        <p className={planningStyles.location}>{place.destination}</p>
        {place.notes && <p className={styles.note}>{place.notes}</p>}
      </div>
    {postMode && <PlaceQuickEdit compact itemId={place.id} name={place.name} rating={place.rating} photos={place.photos} />}
    </div>
    {place.type !== 'transport' && <PlacePeople key={`${place.placeId}:${place.name}:${place.destination}`} compact placeId={place.placeId ?? ''} name={place.name} location={place.destination} />}
    <div className={planningStyles.controls}>
    {!editing ? <button onClick={() => { setName(place.name); setPlaceId(place.placeId ?? ''); setEditing(true); setError(''); setSaved(false) }} type="button" className="min-h-11 text-sm font-semibold text-[#59694f]">Edit details →</button> : <form className="w-full" onSubmit={async event => {
      event.preventDefault(); if (saving.current) return
      saving.current = true; setBusy(true); setError('')
      const data = new FormData(event.currentTarget)
      try { const result = await editPlanPlace(place.id, data); if (result.error) setError(result.error); else { setEditing(false); setSaved(true); router.refresh() } }
      catch { setError('Could not save. Your changes are still here; try again.') }
      finally { saving.current = false; setBusy(false) }
    }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">{place.type === 'transport' ? 'Transport name' : 'Place name'}{place.type === 'transport' ? <input name="name" value={name} onChange={event => setName(event.target.value)} required maxLength={240} className={inputClass} /> : <PlacesAutocomplete name="name" value={name} onChange={value => { setName(value); setPlaceId('') }} onSelect={(_main, _secondary, id) => setPlaceId(id ?? '')} type={place.type === 'food_drink' ? 'restaurant' : place.type === 'hotel' ? 'hotel' : 'activity'} city={place.destination} required maxLength={240} className={inputClass} />}</label>
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="status" value={place.status} />
      <label className="block text-sm">Notes<textarea name="notes" defaultValue={place.notes ?? ''} maxLength={8000} rows={3} className={inputClass} /></label><DayField day={place.day} maxDay={maxDay} />
      <div className="flex gap-3"><button className={buttonClass}>{busy ? 'Saving…' : 'Save changes'}</button><button type="button" onClick={() => setEditing(false)} className="px-3 text-sm">Cancel</button></div>
    </fieldset>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</form>}
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
  }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Trip name<input name="title" required defaultValue={trip.title} maxLength={160} className={inputClass} /></label><label className="block text-sm">Number of days (optional)<input name="durationDays" type="number" min="1" step="1" defaultValue={trip.durationDays ?? ''} className={inputClass} /></label><DateFields start={trip.start} end={trip.end} /><p className="text-xs text-[#73786d]">Leave both dates blank to keep things flexible.</p><button className={buttonClass}>{busy ? 'Saving…' : 'Save details'}</button></fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form>
}
