'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Compass, CalendarDays, ChevronDown, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { copyStoryToPlan } from '@/actions/stories'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import PolaroidTile from '@/components/ui/PolaroidTile'
import { startPlan, copyPlaceToPlan } from '@/actions/planning'
import { importIntoPlan } from '@/actions/planImport'
import { saveImportNotes } from '@/actions/importNotes'
import { readFileForUpload, fetchExtraction } from '@/lib/importFiles'
import { importedPlaces } from '@/lib/planImport'

export const inputClass = 'mt-1.5 w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3 text-sm font-normal normal-case tracking-normal text-ink'
// The shared dark button (see .btn in globals.css).
export const buttonClass = 'btn btn-primary'

export default function NewPlanForm({ savePlace, saveStory }: { savePlace?: string; saveStory?: string }) {
  const router = useRouter()
  const clientId = useRef('')
  const placeCopyId = useRef('')
  const busy = useRef(false)
  const [createdPlan, setCreatedPlan] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [destination, setDestination] = useState('')
  // Other stops on the trip (e.g. Ischia, then Ravello): places you add are filed under the nearest one.
  const [moreDestinations, setMoreDestinations] = useState<string[]>([])
  const [style, setStyle] = useState<'days' | 'ideas'>('ideas')
  const [days, setDays] = useState('')
  // Day-by-day plans: days in each destination (first, then the others), optional. The trip grows to fit them.
  const [stopDays, setStopDays] = useState<string[]>([])
  function setStopDay(index: number, value: string) {
    const next = [...stopDays]; next[index] = value; setStopDays(next)
  }
  // One destination uses "How many days?"; with several, each gets its own days box instead, and they add up.
  const multiStop = style === 'days' && moreDestinations.length > 0
  const stopTotal = stopDays.slice(0, moreDestinations.length + 1).reduce((sum, value) => sum + (Number(value) || 0), 0)
  const stopDaysInput = (index: number, name: string) => multiStop && <input type="number" min={1} max={365} step={1} inputMode="numeric" required aria-label={`Days in ${name || `destination ${index + 1}`}`} value={stopDays[index] ?? ''} onChange={event => setStopDay(index, event.target.value)} placeholder="Days" className="mt-1.5 w-20 shrink-0 rounded-xl border border-line bg-card px-3 py-3 text-sm" />
  const [audience, setAudience] = useState('family')
  // "Import notes or a file" opens here, under the buttons; places are read before the plan is made, so
  // notes with no places don't leave an empty plan behind.
  const [importOpen, setImportOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState('')
  const importId = useRef('')
  return <form onSubmit={async event => {
    event.preventDefault()
    if (busy.current) return
    busy.current = true; setSaving(true); setError('')
    if (!clientId.current) clientId.current = crypto.randomUUID()
    const importing = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'import'
    const data = new FormData(event.currentTarget)
    data.set('clientId', clientId.current)
    try {
      let places: ReturnType<typeof importedPlaces> = []
      if (importing) {
        const where = destination.trim()
        if (!where) { setError('Add where you’re going first, so your places land in the right spot.'); return }
        if (!file && !notes.trim()) { setError('Paste some notes or choose a file to import.'); return }
        setStage('Reading your notes…')
        const payload = file ? await readFileForUpload(file) : { text: notes }
        if ('text' in payload) await saveImportNotes(payload.text).catch(() => null)
        // Everything goes under this destination; each place is still found on Google near its own town.
        places = importedPlaces(await fetchExtraction({ ...payload, planning: true, tripDestinations: [where] }, file?.name ?? 'your notes'))
          .map(place => ({ ...place, destination: where, country: '', near: { name: place.destination, country: place.country } }))
        if (!places.length) { setError('No places found in your notes. Check the place names and try again.'); return }
        if (places.length > 200) { setError('Please split this into smaller imports of up to 200 places.'); return }
        setStage('Adding your places…')
      }
      const result = await startPlan(data)
      if (result.error) setError(result.error)
      else if (result.id) {
        setCreatedPlan(result.id)
        if (savePlace || saveStory) {
          if (!placeCopyId.current) placeCopyId.current = crypto.randomUUID()
          const copied = saveStory ? await copyStoryToPlan(saveStory, result.id, placeCopyId.current, 'new') : await copyPlaceToPlan(savePlace!, result.id, placeCopyId.current, 'new')
          if (copied.error) { setError(`Your plan was saved, but the place couldn’t be added. ${copied.error}`); return }
        }
        if (places.length) {
          if (!importId.current) importId.current = crypto.randomUUID()
          const added = await importIntoPlan(result.id, importId.current, places)
          if (added.error) { setError(`Your plan was saved, but the places couldn’t be added. ${added.error}`); return }
        }
        router.push(`/plan/${result.id}`)
      }
    } catch (caught) { setError(importing && caught instanceof Error && caught.message ? caught.message : 'Could not save. Your details are still here; please try again.') }
    finally { busy.current = false; setSaving(false); setStage('') }
  }} className="panel space-y-5 p-4 sm:p-6">
    {(savePlace || saveStory) && <p className="text-sm text-link">We’ll add the place you selected to this new plan.</p>}
    <fieldset disabled={saving} className="space-y-5">
      {/* Two ways to plan: day by day (asks how many days, so places can go on a day right away), or just
          collecting ideas (a guide). One day is saved as a day trip. */}
      <fieldset>
        <legend className="field-label mb-3">How do you want to plan?</legend>
        <input type="hidden" name="format" value={style === 'ideas' ? 'guide' : days === '1' ? 'day-trip' : 'itinerary'} />
        {/* Same polaroid tiles as Search by trip type. */}
        <div className="mx-auto grid max-w-[260px] grid-cols-2 gap-4 py-1">
          {[
            { value: 'ideas', label: 'Start collecting ideas', photo: 'photo-1499793983690-e29da59ef1c2' },
            { value: 'days', label: 'Plan day by day', photo: 'photo-1435527173128-983b87201f4d' },
          ].map((option, index) => <button key={option.value} type="button" aria-pressed={style === option.value} onClick={() => setStyle(option.value as 'days' | 'ideas')} className="min-w-0">
            <PolaroidTile photo={`https://images.unsplash.com/${option.photo}?auto=format&fit=crop&w=360&q=80`} label={option.label} selected={style === option.value} index={index} size="lg" />
          </button>)}
        </div>
        {style === 'days' && !multiStop && <label className="mt-4 block"><span className="field-label">How many days?</span>
          <input name="durationDays" type="number" inputMode="numeric" min={1} max={365} step={1} required value={days} onChange={event => setDays(event.target.value)} placeholder="e.g. 5" className={inputClass} />
        </label>}
      </fieldset>
      <div className="flex items-end gap-2"><label className="block min-w-0 flex-1"><span className="field-label">Where are you thinking?</span><PlacesAutocomplete name="destination" value={destination} onChange={setDestination} onSelect={(main, secondary) => setDestination([main, secondary].filter(Boolean).join(', '))} type="destination" maxLength={160} placeholder="e.g. Italy, Japan, a weekend away…" className={inputClass} /></label>{stopDaysInput(0, destination)}{multiStop && <span aria-hidden="true" className="size-11 shrink-0" />}</div>
      {moreDestinations.map((value, index) => <div key={index} className="flex items-end gap-2"><label className="block min-w-0 flex-1"><span className="sr-only">Destination {index + 2}</span><PlacesAutocomplete value={value} onChange={next => setMoreDestinations(current => current.map((item, i) => i === index ? next : item))} onSelect={(main, secondary) => setMoreDestinations(current => current.map((item, i) => i === index ? [main, secondary].filter(Boolean).join(', ') : item))} type="destination" maxLength={160} placeholder="Another destination" className={inputClass} /></label>{stopDaysInput(index + 1, value)}<button type="button" aria-label={`Remove destination ${index + 2}`} onClick={() => { setMoreDestinations(current => current.filter((_, i) => i !== index)); setStopDays(current => current.filter((_, i) => i !== index + 1)) }} className="mb-1 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-chip"><X size={18} /></button></div>)}
      {multiStop && <><p className="-mt-2 text-sm text-muted">{stopTotal ? <><span className="font-semibold text-ink">{stopTotal} {stopTotal === 1 ? 'day' : 'days'}</span> in total. </> : ''}Your itinerary sets each place’s days aside for it, in this order.</p><input type="hidden" name="destinationDays" value={JSON.stringify(stopDays.slice(0, moreDestinations.length + 1))} /><input type="hidden" name="durationDays" value={stopTotal || ''} /></>}
      <input type="hidden" name="moreDestinations" value={JSON.stringify(moreDestinations.map(value => value.trim()).filter(Boolean))} />
      {destination.trim() && moreDestinations.length < 9 && <button type="button" onClick={() => { if (!moreDestinations.length && days && !stopDays[0]) setStopDays([days]); setMoreDestinations(current => [...current, '']) }} className="-mt-2 inline-flex items-center gap-1 text-sm font-semibold text-link"><Plus size={16} />Add another destination</button>}
      <label className="block"><span className="field-label">Trip name</span> <span className="text-xs text-muted">(optional)</span><input name="title" maxLength={160} placeholder="Summer in Italy" className={inputClass} /></label>
      <fieldset><legend className="field-label mb-2">Who is this trip for?</legend><input type="hidden" name="audience" value={audience} /><div className="flex flex-wrap gap-2">{([{ value: 'family', label: 'Family' }, { value: 'friends', label: 'Friends' }, { value: 'romantic', label: 'Couples' }, { value: 'adult', label: 'Adults' }] as const).map(option => <button key={option.value} type="button" aria-pressed={audience === option.value} onClick={() => setAudience(option.value)} className="chip">{option.label}</button>)}</div></fieldset>
      <details><summary className="flex cursor-pointer list-none items-center gap-3 py-2 text-sm text-link"><CalendarDays size={20} />Add dates (optional)<ChevronDown size={18} className="ml-auto" /></summary><DateFields /></details>
      <p className="flex items-start gap-3 rounded-xl bg-paper p-4 text-sm leading-relaxed text-link"><Compass size={26} className="mt-1 shrink-0" /><span>Start with an idea. Save hotels, restaurants, and things to do as you find them. Your plan stays private until you share it.</span></p>
      <button type="submit" value="plan" className={`${buttonClass} w-full`}>{saving && !stage ? 'Saving your plan…' : 'Start planning →'}</button>
      <button type="button" aria-expanded={importOpen} aria-controls="new-plan-import" onClick={() => setImportOpen(open => !open)} className="btn btn-outline w-full">Import notes or a file</button>
      {importOpen && <div id="new-plan-import" className="space-y-4 rounded-xl border border-line p-4">
        <p className="text-sm text-muted">{destination.trim() ? <>Places from your notes go under <strong className="text-ink">{destination}</strong>. Each one shows its own town once it’s found on Google.</> : 'Add where you’re going above, then paste your notes or choose a file.'}</p>
        <label className="block text-sm">Paste notes<textarea value={notes} onChange={event => { setNotes(event.target.value); setFile(null) }} maxLength={200000} rows={5} placeholder="Hotels, restaurants, activities…" className="mt-2 w-full rounded-xl border border-line bg-white p-3 text-base" /></label>
        <label className="block text-sm">Or choose a file<input key={file?.name ?? 'empty'} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.html,.htm,image/jpeg,image/png,image/gif,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full min-w-0 text-sm" /></label>
        {file && <p className="break-words text-xs text-muted">Selected: {file.name}</p>}
        <button type="submit" value="import" disabled={!destination.trim() || (!file && !notes.trim())} className={`${buttonClass} w-full`}>{stage || (destination.trim() ? 'Import and start planning →' : 'Add a destination first')}</button>
      </div>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {error && createdPlan && <Link href={`/plan/${createdPlan}`} className="block text-sm text-link underline">Open your saved plan →</Link>}
  </form>
}

export function DateFields({ start = '', end = '' }: { start?: string; end?: string }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block min-w-0 text-sm">Start date<input name="startDate" type="date" defaultValue={start} className={inputClass} /></label>
    <label className="block min-w-0 text-sm">End date<input name="endDate" type="date" defaultValue={end} className={inputClass} /></label>
  </div>
}
