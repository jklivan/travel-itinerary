'use client'

import BackButton from '@/components/BackButton'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { copyPlacesToPlan, findFriendsPlanPlaces } from '@/actions/planSuggestions'
import { samePlanPlace } from '@/lib/planPlaceIdentity'

type Results = Awaited<ReturnType<typeof findFriendsPlanPlaces>>
type Trip = NonNullable<Results['trips']>[number]
type Place = Trip['places'][number]
const categories: Record<string, string> = { hotel: 'Hotel', food_drink: 'Food & drink', activity: 'Things to do', transport: 'Transport' }

export default function PlanFriendsBrowser({ plan, initialQuery, initialResults }: {
  plan: { id: string; title: string; destinations: { name: string }[] }; initialQuery: string; initialResults: Results
}) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [searchedQuery, setSearchedQuery] = useState(initialQuery)
  const [trips, setTrips] = useState(initialResults.trips ?? [])
  const [hasMore, setHasMore] = useState(initialResults.hasMore ?? false)
  const [selected, setSelected] = useState(new Map<string, Place>())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(initialResults.error ?? '')
  const [success, setSuccess] = useState('')
  const busy = useRef(false)

  async function search(value: string, more = false) {
    if (busy.current || !value.trim()) return
    busy.current = true; setLoading(true); setError(''); setSuccess('')
    try {
      const result = await findFriendsPlanPlaces(plan.id, value.trim(), more ? trips.at(-1)?.id : undefined)
      if (result.error) { setError(result.error); return }
      setTrips(previous => more ? [...previous, ...(result.trips ?? []).filter(trip => !previous.some(p => p.id === trip.id))] : result.trips ?? [])
      setHasMore(result.hasMore ?? false); setSearchedQuery(value.trim())
    } catch { setError('Could not load your friends’ trips. Please try again.') }
    finally { busy.current = false; setLoading(false) }
  }
  function toggle(places: Place[], checked: boolean) {
    setSuccess(''); setError('')
    const next = new Map(selected)
    for (const place of places) {
      if (place.alreadyAdded) continue
      if (checked) next.set(place.id, place)
      else next.delete(place.id)
    }
    if (next.size > 100) { setError('You can add up to 100 places at a time. Add this selection first, then keep browsing.'); return }
    setSelected(next)
  }
  async function addSelected() {
    if (busy.current || !selected.size) return
    busy.current = true; setSaving(true); setError(''); setSuccess('')
    try {
      const result = await copyPlacesToPlan([...selected.keys()], plan.id)
      if (!('added' in result)) { setError(result.error); return }
      const addedPlaces = [...selected.values()]
      setTrips(previous => previous.map(trip => ({ ...trip, places: trip.places.map(place => ({ ...place, alreadyAdded: place.alreadyAdded || addedPlaces.some(added => samePlanPlace(added, place)) })) })))
      setSelected(new Map())
      setSuccess(`${result.added} ${result.added === 1 ? 'place added' : 'places added'} to ${plan.title}.${result.skipped ? ` ${result.skipped} already in your plan or repeated in this selection.` : ''}`)
      router.refresh()
    } catch { setError('Could not add these places. Your selection is still here; please try again.') }
    finally { busy.current = false; setSaving(false) }
  }

  return <div className="mx-auto max-w-2xl px-4 py-6 pb-64 text-[#2e4147]">
    <BackButton fallback={`/plan/${plan.id}`} className="text-sm text-[#59694f]">← Back</BackButton>
    <h1 className="mt-5 font-[family-name:var(--font-playfair)] text-3xl">Browse friends’ places</h1>
    <p className="mt-2 text-sm leading-relaxed text-[#73786d]">Pick places from several trips and add them to {plan.title} together. Keep browsing without leaving your plan.</p>
    <form className="mt-5" onSubmit={event => { event.preventDefault(); void search(query) }}>
      <label className="block text-sm font-semibold" htmlFor="friends-destination">City or destination</label>
      <div className="mt-2 flex gap-2"><input id="friends-destination" value={query} maxLength={160} required disabled={loading || saving} onChange={event => setQuery(event.target.value)} placeholder="London" className="min-w-0 flex-1 rounded-xl border border-[#8caaa3] bg-[#fffdf7] p-3 text-base" /><button disabled={loading || saving || !query.trim()} className="min-h-11 rounded-xl bg-[#59694f] px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Searching…' : 'Find trips'}</button></div>
    </form>
    {plan.destinations.filter(d => d.name !== 'Destination to decide').length > 1 && <div className="mt-3 flex flex-wrap gap-2">{plan.destinations.filter(d => d.name !== 'Destination to decide').map(d => <button key={d.name} type="button" disabled={loading || saving} onClick={() => { const value = d.name.split(',')[0]; setQuery(value); void search(value) }} className="min-h-11 rounded-full border border-[#d7cebc] px-3 text-sm">{d.name}</button>)}</div>}
    {selected.size > 0 && <details className="mt-4 rounded-xl border border-[#d7cebc] bg-[#fffdf7] p-3"><summary className="cursor-pointer text-sm font-semibold">{selected.size} selected across your friends’ trips</summary><ul className="mt-2 space-y-1">{[...selected.values()].map(place => <li key={place.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 break-words">{place.name} · {place.destination.name}</span><button type="button" disabled={saving || loading} aria-label={`Remove ${place.name} from selection`} className="min-h-11 shrink-0 text-[#59694f] underline" onClick={() => toggle([place], false)}>Remove</button></li>)}</ul></details>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <div role="status" className="mt-4 rounded-xl border border-[#8caaa3] bg-[#e6ece5] p-4 text-sm"><p>{success}</p><Link href={`/plan/${plan.id}`} className="mt-2 inline-block font-semibold text-[#59694f] underline">Open your plan →</Link><p className="mt-2 text-xs">New places are unscheduled, ready for your own notes and days.</p></div>}
    <div aria-busy={loading} className="mt-6 space-y-4">
      <h2 className="text-lg font-semibold">{searchedQuery ? `Friends’ trips for ${searchedQuery}` : 'Find ideas from your friends'}</h2>
      {!trips.length && !loading && !error && <p className="rounded-xl border border-dashed border-[#c4b99e] p-5 text-sm text-[#73786d]">{searchedQuery ? 'No matching trips from the people you follow yet. Try another city or a broader destination.' : 'Enter a destination to see trips from the people you follow.'} <Link href="/friends" className="text-[#59694f] underline">Find friends</Link></p>}
      {trips.map((trip, index) => {
        const available = trip.places.filter(place => !place.alreadyAdded)
        const allSelected = available.length > 0 && available.every(place => selected.has(place.id))
        return <details key={trip.id} open={index === 0 ? true : undefined} className="rounded-2xl border border-[#d7cebc] bg-[#fffdf7]">
          <summary className="cursor-pointer p-4"><span className="font-semibold text-[#59694f]">{trip.author}</span><span className="mt-1 block break-words font-[family-name:var(--font-playfair)] text-xl">{trip.title}</span><span className="mt-1 block text-xs text-[#73786d]">{trip.places.length} places{trip.places.some(place => selected.has(place.id)) ? ` · ${trip.places.filter(place => selected.has(place.id)).length} selected` : ''}</span></summary>
          <div className="border-t border-[#d7cebc] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={saving || loading || !available.length} onClick={() => toggle(available, !allSelected)} className="min-h-11 text-sm font-semibold text-[#59694f] disabled:opacity-50">{allSelected ? 'Deselect all in this trip' : 'Select all in this trip'}</button><Link href={`/itinerary/${trip.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#73786d] underline">Open original trip ↗</Link></div>
            <div className="divide-y divide-[#e4dece]">{trip.places.map(place => <div key={place.id} className="py-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg p-2 ${selected.has(place.id) ? 'bg-[#e6ece5]' : ''}`}>
                <input type="checkbox" checked={place.alreadyAdded || selected.has(place.id)} disabled={place.alreadyAdded || saving || loading} onChange={event => toggle([place], event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#59694f]" />
                <span className="min-w-0"><span className="block break-words text-sm font-semibold">{place.name}</span><span className="mt-1 block text-xs text-[#73786d]">{categories[place.type] ?? place.type} · {place.destination.name}{place.rating ? ` · ${place.rating}/5` : ''}</span>{place.address && <span className="mt-1 block break-words text-xs text-[#73786d]">{place.address}</span>}{place.alreadyAdded && <span className="mt-1 block text-xs font-semibold text-[#59694f]">Already in your plan</span>}</span>
              </label>
              {place.notes && <details className="ml-10 mt-1 text-sm"><summary className="min-h-8 cursor-pointer text-[#59694f]">Read {trip.author}’s notes</summary><p className="mt-2 whitespace-pre-wrap break-words text-[#73786d]">{place.notes}</p></details>}
            </div>)}</div>
          </div>
        </details>
      })}
      {hasMore && <button type="button" disabled={loading || saving} onClick={() => void search(searchedQuery, true)} className="min-h-11 w-full rounded-xl border border-[#8caaa3] text-sm text-[#59694f]">{loading ? 'Loading…' : 'More friends’ trips'}</button>}
    </div>
    {selected.size > 0 && <div className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[40rem] rounded-2xl border border-[#8caaa3] bg-[#fffdf7] p-3 shadow-lg"><button type="button" disabled={saving || loading} onClick={() => void addSelected()} className="min-h-12 w-full rounded-xl bg-[#59694f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Adding places…' : `Add ${selected.size} ${selected.size === 1 ? 'place' : 'places'} to your plan`}</button><button type="button" disabled={saving || loading} onClick={() => setSelected(new Map())} className="mt-1 min-h-9 w-full text-xs text-[#73786d] underline">Clear selection</button></div>}
  </div>
}
