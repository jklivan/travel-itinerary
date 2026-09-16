'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MapPin, LockKeyhole, CalendarDays, Check, Hotel, Utensils, Camera } from 'lucide-react'
import { addPlanPlace, editPlanPlace, savePlanDetails, sharePlan, removePlanPlace } from '@/actions/planning'
import DeleteButton from '@/components/DeleteButton'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import PlanningMap from '@/components/PlanningMap'
import PlaceQuickEdit from '@/components/PlaceQuickEdit'
import { DateFields, inputClass, buttonClass } from '../NewPlanForm'

type Place = { lat: number | null; lng: number | null; placeId: string | null; id: string; name: string; type: string; notes: string | null; status: string; day: number | null; rating: number | null; photos: string[] }
type Trip = { id: string; title: string; isPlan: boolean; visibility: string; start: string; end: string; destinations: { id: string; name: string; country: string | null; items: Place[] }[] }
const categories = [{ value: 'hotel', label: 'Hotels' }, { value: 'food_drink', label: 'Restaurants & drinks' }, { value: 'activity', label: 'Things to do' }]

export default function Planner({ trip }: { trip: Trip }) {
  const router = useRouter()
  const [tab, setTab] = useState<'places' | 'itinerary' | 'map'>('places')
  const [mapOpened, setMapOpened] = useState(false)
  const [adding, setAdding] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [confirmShare, setConfirmShare] = useState(false)
  const [error, setError] = useState('')
  const places = trip.destinations.flatMap(d => d.items.map(item => ({ ...item, destination: [d.name, d.country].filter(Boolean).join(', ') })))
  const scheduled = [...new Set(places.flatMap(p => p.day === null ? [] : [p.day]))].sort((a, b) => a - b)
  function renderPlace(place: Place & { destination: string }) { return <PlaceRow key={place.id} place={place} /> }
  return <div className="mx-auto max-w-2xl px-4 py-6 text-[#2e4147]">
    <Link href="/plan" className="text-sm text-[#507c76]">← Your trips</Link>
    <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#507c76]"><LockKeyhole size={14} />{trip.visibility === 'draft' ? 'Private plan · Only you' : 'Shared trip'}</div>
    <h1 className="mt-2 break-words font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">{trip.title}</h1>
    <p className="mt-2 flex items-center gap-2 text-sm text-[#73786d]"><CalendarDays size={16} />{trip.start ? `${trip.start} — ${trip.end}` : 'Dates are flexible'} · {places.length} places</p>
    {trip.isPlan && <details className="mt-3"><summary className="cursor-pointer py-2 text-sm text-[#507c76]">Edit trip name & dates</summary><DetailsForm key={`${trip.title}:${trip.start}:${trip.end}`} trip={trip} /></details>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {trip.visibility === 'draft' && trip.isPlan ? <button disabled={!places.length} onClick={() => setConfirmShare(true)} className="min-h-11 rounded-xl border border-[#d7cebc] px-4 text-sm disabled:opacity-50">Share trip</button> : <Link href={trip.visibility === 'draft' ? `/itinerary/${trip.id}/edit` : `/itinerary/${trip.id}`} className="min-h-11 rounded-xl border border-[#d7cebc] px-4 py-3 text-sm">{trip.visibility === 'draft' ? 'Edit & publish' : 'View shared trip'}</Link>}
      <span className="text-xs text-[#73786d]">{trip.visibility === 'draft' ? 'Share whenever you’re ready.' : 'Saved changes appear on your shared trip.'}</span>
    </div>
    {confirmShare && <section className="mt-3 rounded-xl border border-[#d7cebc] bg-white p-4" aria-label="Share trip confirmation"><p className="text-sm">Sharing makes this trip, including its places, notes, and photos, visible to others. You can keep adding to it afterward.</p><div className="mt-3 flex gap-3"><button disabled={sharing} className={buttonClass} onClick={async () => {
      setSharing(true); setError('')
      try { const result = await sharePlan(trip.id); if (result.error) setError(result.error); else { setConfirmShare(false); router.push(`/itinerary/${trip.id}`); router.refresh() } }
      catch { setError('Could not share. Please try again.') } finally { setSharing(false) }
    }}>{sharing ? 'Sharing…' : 'Share publicly'}</button><button disabled={sharing} onClick={() => setConfirmShare(false)} className="px-3 text-sm">Keep private</button></div>{error && <p role="alert" className="mt-2 text-red-700">{error}</p>}</section>}
    <div className="sticky top-0 z-20 -mx-1 mt-5 bg-[#F3EAD9] px-1 py-3">
      <button className={`${buttonClass} flex w-full items-center justify-center gap-2`} onClick={() => setAdding(true)}><Plus size={20} />Add a place</button>
    </div>
    {adding && <AddPlace trip={trip} onClose={() => setAdding(false)} />}
    <div role="tablist" aria-label="Trip view" className="mb-5 mt-3 flex border-b border-[#d7cebc]">{(['places', 'itinerary', 'map'] as const).map(value => <button key={value} role="tab" id={`${value}-tab`} aria-controls="trip-panel" aria-selected={tab === value} onClick={() => { setTab(value); if (value === 'map') setMapOpened(true) }} className={`min-h-12 flex-1 border-b-2 p-3 font-semibold ${tab === value ? 'border-[#507c76] text-[#507c76]' : 'border-transparent text-[#73786d]'}`}>{value === 'places' ? 'Places' : value === 'map' ? 'Map' : 'Itinerary'}</button>)}</div>
    <section role="tabpanel" id="trip-panel" aria-labelledby={`${tab}-tab`}>
      {mapOpened && <div hidden={tab !== 'map'}><PlanningMap places={places.map(place => ({ id: place.id, name: place.name, city: place.destination, type: place.type === 'hotel' ? 'hotel' : place.type === 'food_drink' ? 'food_drink' : 'activity', day: place.day, placeId: place.placeId ?? undefined, lat: place.lat, lng: place.lng }))} /></div>}
      {tab === 'map' ? null : !places.length ? <div className="rounded-2xl border border-dashed border-[#c4b99e] p-8 text-center"><MapPin className="mx-auto mb-3 text-[#507c76]" /><h2 className="text-xl font-semibold">A place to start</h2><p className="mt-2 text-sm text-[#73786d]">A hotel you love, a restaurant someone mentioned, something you want to do. Add it now and decide when later.</p></div> : tab === 'places' ? <>
        <p className="mb-5 text-sm text-[#73786d]">Everything you’re considering, all in one place. Days are optional.</p>
        {categories.map(category => { const items = places.filter(p => p.type === category.value); return items.length > 0 && <section key={category.value} className="mb-7"><h2 className="mb-3 text-lg font-semibold">{category.label} <span className="text-sm font-normal text-[#73786d]">{items.length}</span></h2><div className="space-y-3">{items.map(renderPlace)}</div></section> })}
      </> : <>
        <p className="mb-5 text-sm text-[#73786d]">Give a place a day whenever you’re ready. Everything else stays in Unscheduled.</p>
        {scheduled.map(day => <section key={day} className="mb-6"><h2 className="mb-3 text-lg font-semibold">Day {day}</h2><div className="space-y-3">{places.filter(p => p.day === day).map(renderPlace)}</div></section>)}
        <section><h2 className="mb-3 text-lg font-semibold">Unscheduled</h2><div className="space-y-3">{places.filter(p => p.day === null).map(renderPlace)}</div>{places.every(p => p.day !== null) && <p className="text-sm text-[#73786d]">All your places have a day.</p>}</section>
      </>}
    </section>
    <div className="mt-8 border-t border-[#d7cebc] pt-5"><DeleteButton id={trip.id} /></div>
  </div>
}

function AddPlace({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const clientId = useRef('')
  const [name, setName] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [category, setCategory] = useState('hotel')
  const [destination, setDestination] = useState(trip.destinations[0]?.name === 'Destination to decide' ? '' : trip.destinations[0]?.name ?? '')
  const selectedDestination = trip.destinations.find(d => d.name === destination)
  const city = [destination, selectedDestination?.country].filter(Boolean).join(', ')
  function changeDestination(value: string) { setDestination(value); setPlaceId('') }

  return <form className="mb-4 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4" onSubmit={async event => {
    event.preventDefault()
    if (saving.current) return
    saving.current = true; setBusy(true); setError('')
    if (!clientId.current) clientId.current = crypto.randomUUID()
    const data = new FormData(event.currentTarget); data.set('clientId', clientId.current)
    try { const result = await addPlanPlace(trip.id, data); if (result.error) setError(result.error); else { router.refresh(); onClose() } }
    catch { setError('Could not save. Your place is still here; try again.') }
    finally { saving.current = false; setBusy(false) }
  }}><h2 className="mb-3 text-lg font-semibold">Add a place</h2><fieldset disabled={busy} className="space-y-3">
    <label className="block text-sm">Destination<PlacesAutocomplete name="destination" required maxLength={160} value={destination} onChange={changeDestination} onSelect={(main, secondary) => changeDestination([main, secondary].filter(Boolean).join(', '))} type="destination" placeholder="City or area" className={inputClass} /></label>
    {trip.destinations.length > 1 && <div className="flex flex-wrap gap-2">{trip.destinations.filter(d => d.name !== 'Destination to decide').map(d => <button type="button" key={d.id} onClick={() => changeDestination(d.name)} className="min-h-11 rounded-lg border border-[#d7cebc] px-3 text-xs">{d.name}</button>)}</div>}
    <fieldset><legend className="mb-2 text-sm">Category</legend><div className="flex flex-wrap gap-2">
      {[
        { value: 'hotel', label: 'Hotel / Airbnb', Icon: Hotel, color: 'peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700' },
        { value: 'food_drink', label: 'Food / Drink', Icon: Utensils, color: 'peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-checked:text-orange-700' },
        { value: 'activity', label: 'Activity', Icon: Camera, color: 'peer-checked:border-green-600 peer-checked:bg-green-50 peer-checked:text-green-700' },
      ].map(({ value, label, Icon, color }) => <label key={value} className="cursor-pointer">
        <input type="radio" name="type" value={value} checked={category === value} onChange={() => { setCategory(value); setPlaceId('') }} className="peer sr-only" />
        <span className={`flex min-h-11 items-center gap-2 rounded-full border border-[#d7cebc] bg-white px-3 py-2 text-sm font-medium text-[#73786d] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#507c76] peer-disabled:opacity-50 ${color}`}><Icon size={16} />{label}</span>
      </label>)}
    </div></fieldset>
    <label className="block text-sm">Place name<PlacesAutocomplete required name="name" maxLength={240} value={name} onChange={value => { setName(value); setPlaceId('') }} onSelect={(_main, _secondary, id) => setPlaceId(id ?? '')} type={category === 'food_drink' ? 'restaurant' : category === 'hotel' ? 'hotel' : 'activity'} city={city || undefined} placeholder="Hotel, restaurant, museum…" className={inputClass} /></label>
    <input type="hidden" name="placeId" value={placeId} />
    {city && <p className="text-xs text-[#73786d]">Suggestions near {city}</p>}
    <label className="block text-sm">Notes (optional)<textarea name="notes" maxLength={8000} rows={3} placeholder="Reservation details, a recommendation, a reminder…" className={inputClass} /></label>
    <DayField />
    <div className="flex gap-3"><button className={buttonClass}>{busy ? 'Saving…' : 'Save place'}</button><button type="button" onClick={onClose} className="min-h-11 px-3 text-sm">Cancel</button></div>
  </fieldset>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</form>
}
function DayField({ day }: { day?: number | null }) {
  return <label className="block text-sm">Day (optional)<input name="day" type="number" min={1} max={365} defaultValue={day ?? ''} placeholder="Unscheduled" className={inputClass} /></label>
}
function PlaceRow({ place }: { place: Place & { destination: string } }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [removing, setRemoving] = useState(false)
  const saving = useRef(false)
  const [name, setName] = useState(place.name)
  const [placeId, setPlaceId] = useState(place.placeId ?? '')
  return <article className="min-w-0 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{place.name}</h3><p className="mt-1 text-xs text-[#73786d]">{place.destination} · {place.day === null ? 'Unscheduled' : `Day ${place.day}`}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs ${place.status === 'visited' ? 'bg-[#dcebe2] text-[#365e48]' : place.status === 'booked' ? 'bg-[#e5e9f5] text-[#495d86]' : 'bg-[#f0e8d9] text-[#7b6544]'}`}>{place.status === 'visited' ? 'Visited' : place.status === 'booked' ? 'Booked' : 'Considering'}</span></div>
    {place.notes && !editing && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{place.notes}</p>}
    {!editing ? <button onClick={() => { setName(place.name); setPlaceId(place.placeId ?? ''); setEditing(true); setError(''); setSaved(false) }} className="mt-2 min-h-11 text-sm font-medium text-[#507c76]">Edit notes, day & status</button> : <form className="mt-3" onSubmit={async event => {
      event.preventDefault(); if (saving.current) return
      saving.current = true; setBusy(true); setError('')
      const data = new FormData(event.currentTarget)
      try { const result = await editPlanPlace(place.id, data); if (result.error) setError(result.error); else { setEditing(false); setSaved(true); router.refresh() } }
      catch { setError('Could not save. Your changes are still here; try again.') }
      finally { saving.current = false; setBusy(false) }
    }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Place name<PlacesAutocomplete name="name" value={name} onChange={value => { setName(value); setPlaceId('') }} onSelect={(_main, _secondary, id) => setPlaceId(id ?? '')} type={place.type === 'food_drink' ? 'restaurant' : place.type === 'hotel' ? 'hotel' : 'activity'} city={place.destination} required maxLength={240} className={inputClass} /></label>
      <input type="hidden" name="placeId" value={placeId} />
      <label className="block text-sm">Status<select name="status" defaultValue={place.status} className={inputClass}><option value="considering">Considering</option><option value="booked">Booked</option><option value="visited">Visited</option></select></label>
      <label className="block text-sm">Notes<textarea name="notes" defaultValue={place.notes ?? ''} maxLength={8000} rows={3} className={inputClass} /></label><DayField day={place.day} />
      <div className="flex gap-3"><button className={buttonClass}>{busy ? 'Saving…' : 'Save changes'}</button><button type="button" onClick={() => setEditing(false)} className="px-3 text-sm">Cancel</button></div>
    </fieldset>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</form>}
    {saved && <p role="status" className="flex items-center gap-1 text-xs text-[#507c76]"><Check size={14} />Saved</p>}
    {!editing && <div className="mb-2">{!removing ? <button className="min-h-11 text-xs text-[#73786d] underline" onClick={() => setRemoving(true)}>Remove place</button> : <div className="text-sm"><p>Remove this place and its notes from your trip?</p><button disabled={busy} className="min-h-11 pr-4 text-red-700" onClick={async () => {
      if (saving.current) return
      saving.current = true; setBusy(true); setError('')
      try { const result = await removePlanPlace(place.id); if (result.error) setError(result.error); else router.refresh() }
      catch { setError('Could not remove. Please try again.') } finally { saving.current = false; setBusy(false) }
    }}>{busy ? 'Removing…' : 'Remove'}</button><button disabled={busy} className="min-h-11" onClick={() => setRemoving(false)}>Keep place</button></div>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>}
    <PlaceQuickEdit itemId={place.id} name={place.name} rating={place.rating} photos={place.photos} />
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
  }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Trip name<input name="title" required defaultValue={trip.title} maxLength={160} className={inputClass} /></label><DateFields start={trip.start} end={trip.end} /><p className="text-xs text-[#73786d]">Leave both dates blank to keep things flexible.</p><button className={buttonClass}>{busy ? 'Saving…' : 'Save details'}</button></fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form>
}
