'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Compass, CalendarDays, ChevronDown, FileText, Plus, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { copyStoryToPlan } from '@/actions/stories'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import { startPlan, copyPlaceToPlan } from '@/actions/planning'
import { importIntoPlan } from '@/actions/planImport'
import { datesCovering, isDate } from '@/lib/placeDates'
import { readFileForUpload, fetchExtraction } from '@/lib/importFiles'
import { importedPlaces } from '@/lib/planImport'
import AiAgentTip, { markAiAgentTipSeen } from '@/components/AiAgentTip'

export const inputClass = 'field mt-1.5'
// The shared dark button (see .btn in globals.css).
export const buttonClass = 'btn btn-primary'

// past: posting a trip they've already taken (Post → Another trip), so the wording is in the past tense.
export default function NewPlanForm({ savePlace, saveStory, past = false }: { savePlace?: string; saveStory?: string; past?: boolean }) {
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
  const [days, setDays] = useState('')
  // Day-by-day plans: days in each destination (first, then the others), optional. The trip grows to fit them.
  const [stopDays, setStopDays] = useState<string[]>([])
  function setStopDay(index: number, value: string) {
    const next = [...stopDays]; next[index] = value; setStopDays(next)
  }
  // One destination uses "How many days?"; with several, each gets its own (optional) days box instead, and they add up.
  const multiStop = moreDestinations.length > 0
  const stopTotal = stopDays.slice(0, moreDestinations.length + 1).reduce((sum, value) => sum + (Number(value) || 0), 0)
  const stopDaysInput = (index: number, name: string) => multiStop && <input type="number" min={1} max={365} step={1} inputMode="numeric" aria-label={`Days in ${name || `destination ${index + 1}`}`} value={stopDays[index] ?? ''} onChange={event => setStopDay(index, event.target.value)} placeholder="Days" className="field mt-1.5 w-20 shrink-0" />
  const [audience, setAudience] = useState('family')
  // "Import notes or a file" opens here, under the buttons; places are read before the plan is made, so
  // notes with no places don't leave an empty plan behind.
  const [importOpen, setImportOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState('')
  const importId = useRef('')
  // The destination you typed, when the document's own stops were used instead (removed if nothing ends up in it).
  const splitFrom = useRef('')
  return <form onSubmit={async event => {
    event.preventDefault()
    if (busy.current) return
    busy.current = true; setSaving(true); setError('')
    if (!clientId.current) clientId.current = crypto.randomUUID()
    const importing = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'import'
    if (importing) markAiAgentTipSeen()
    const data = new FormData(event.currentTarget)
    data.set('clientId', clientId.current)
    try {
      let places: ReturnType<typeof importedPlaces> = []
      if (importing) {
        // Where you're going is optional: without it, places go under the town or city the document gives for each.
        const where = destination.trim()
        if (!file && !notes.trim()) { setError('Choose a file or paste some notes to import.'); return }
        setStage('Reading your notes…')
        const payload = file ? await readFileForUpload(file) : { text: notes }
        // Everything goes under this destination; each place is still found on Google near its own town.
        const found = importedPlaces(await fetchExtraction({ ...payload, planning: true, tripDestinations: where ? [where] : [] }, file?.name ?? 'your notes'))
        if (!found.length) { setError('No places found in your notes. Check the place names and try again.'); return }
        // The plan starts at your destination, or the first place's town when you didn't give one.
        const start = where || found[0].destination
        if (!where) data.set('destination', start)
        // A document split into named stops (Loire Valley, Bordeaux, Paris) keeps them, even when you gave one destination.
        splitFrom.current = !!where && new Set(found.map(place => place.destination.trim().toLowerCase())).size >= 2 ? where : ''
        places = where && !splitFrom.current ? found.map(place => ({ ...place, destination: where, country: '', near: { name: place.destination, country: place.country } }))
          : found.map(place => !where && place.destination === start ? { ...place, country: '' } : place)
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
          // The trip's dates cover the bookings: taken from them when you gave none, stretched for an overnight flight the day before.
          const typedStart = String(data.get('startDate') ?? ''), typedEnd = String(data.get('endDate') ?? '')
          const dates = datesCovering(places, isDate(typedStart) && isDate(typedEnd) && typedEnd >= typedStart ? { start: typedStart, end: typedEnd } : null)
          const added = await importIntoPlan(result.id, importId.current, places, dates, splitFrom.current || undefined)
          if (added.error) { setError(`Your plan was saved, but the places couldn’t be added. ${added.error}`); return }
        }
        router.push(`/plan/${result.id}`)
      }
    } catch (caught) { setError(importing && caught instanceof Error && caught.message ? caught.message : 'Could not save. Your details are still here; please try again.') }
    finally { busy.current = false; setSaving(false); setStage('') }
  }} className="space-y-5">
    {/* Importing first: an itinerary, notes or a screenshot become the trip's places. Opens its panel right below. */}
    <div className="relative pt-5">
      <span aria-hidden="true" className="absolute right-6 top-0 z-[1] rounded-full bg-mist px-3 py-1 text-xs font-medium text-ink shadow-card after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-x-[6px] after:border-t-[6px] after:border-x-transparent after:border-t-mist">Have an itinerary already?</span>
      <button type="button" aria-expanded={importOpen} aria-controls="new-plan-import" disabled={saving} onClick={() => setImportOpen(open => !open)} className="flex w-full items-center gap-4 rounded-2xl border border-mist-line bg-mist p-4 text-left text-ink transition-colors hover:bg-mist-strong disabled:opacity-60">
        <FileText size={28} strokeWidth={1.5} className="shrink-0 text-link" />
        <span className="min-w-0 flex-1"><span className="block text-base font-medium sm:text-lg">Import an itinerary or notes</span><span className="mt-0.5 block text-label font-medium uppercase tracking-caps text-muted">PDF, doc, text or screenshot</span></span>
        <ArrowRight size={22} className={`shrink-0 text-link transition-transform ${importOpen ? 'rotate-90' : ''}`} />
      </button>
    </div>
    {/* A one-time tip: an AI assistant can send you an itinerary to import. */}
    <AiAgentTip hidden={importOpen} />
    {importOpen && <fieldset disabled={saving} id="new-plan-import" className="panel space-y-4 p-4">
        <p className="text-sm text-muted">{destination.trim() ? <>Places go under <strong className="text-ink">{destination}</strong>. Each one shows its own town once it’s found on Google.</> : `Each place goes under the town or city your file gives for it. Add where you${past ? ' went' : '’re going'} above to put them all in one place.`}</p>
        {/* Choosing a file is the main way in, so it's a big tile first; pasting notes is the alternative. */}
        <label className={`panel-dashed flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 p-4 text-center hover:bg-cream ${file ? 'border-link' : ''}`}>
          <Upload size={22} className="text-link" />
          <span className="text-base font-semibold text-link">{file ? file.name : 'Choose a file'}</span>
          <span className="text-xs text-muted">{file ? 'Tap to choose a different file' : 'PDF, Word, Excel, screenshot or email'}</span>
          <input key={file?.name ?? 'empty'} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.html,.htm,image/jpeg,image/png,image/gif,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} className="sr-only" />
        </label>
        <label className="block text-sm">Or paste notes<textarea value={notes} onChange={event => { setNotes(event.target.value); setFile(null) }} maxLength={200000} rows={5} placeholder="Hotels, restaurants, activities…" className="field mt-2" /></label>
        <button type="submit" value="import" disabled={!file && !notes.trim()} className={`${buttonClass} w-full`}>{stage || 'Import and start planning →'}</button>
      </fieldset>}
    <div className="panel space-y-5 p-4 sm:p-6">
    {(savePlace || saveStory) && <p className="text-sm text-link">We’ll add the place you selected to this new plan.</p>}
    <fieldset disabled={saving} className="space-y-5">
      {/* No days or dates: a list of ideas. A number of days or dates: day by day (one day: a day trip). */}
      <input type="hidden" name="format" value="auto" />
      <div className="flex items-end gap-2"><label className="block min-w-0 flex-1"><span className="field-label">{past ? 'Where did you go?' : 'Where are you thinking?'}</span><PlacesAutocomplete name="destination" value={destination} onChange={setDestination} onSelect={(main, secondary) => setDestination([main, secondary].filter(Boolean).join(', '))} type="destination" maxLength={160} placeholder={past ? 'e.g. Italy, Tokyo, a weekend in Napa…' : 'e.g. Italy, Japan, a weekend away…'} className={inputClass} /></label>{stopDaysInput(0, destination)}{multiStop && <span aria-hidden="true" className="size-11 shrink-0" />}</div>
      {moreDestinations.map((value, index) => <div key={index} className="flex items-end gap-2"><label className="block min-w-0 flex-1"><span className="sr-only">Destination {index + 2}</span><PlacesAutocomplete value={value} onChange={next => setMoreDestinations(current => current.map((item, i) => i === index ? next : item))} onSelect={(main, secondary) => setMoreDestinations(current => current.map((item, i) => i === index ? [main, secondary].filter(Boolean).join(', ') : item))} type="destination" maxLength={160} placeholder="Another destination" className={inputClass} /></label>{stopDaysInput(index + 1, value)}<button type="button" aria-label={`Remove destination ${index + 2}`} onClick={() => { setMoreDestinations(current => current.filter((_, i) => i !== index)); setStopDays(current => current.filter((_, i) => i !== index + 1)) }} className="mb-1 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-chip"><X size={18} /></button></div>)}
      {multiStop && <><p className="-mt-2 text-sm text-muted">{stopTotal ? <><span className="font-semibold text-ink">{stopTotal} {stopTotal === 1 ? 'day' : 'days'}</span> in total. Your itinerary sets each place’s days aside for it, in this order.</> : 'Days for each place are optional.'}</p><input type="hidden" name="destinationDays" value={JSON.stringify(stopDays.slice(0, moreDestinations.length + 1))} /><input type="hidden" name="durationDays" value={stopTotal || ''} /></>}
      <input type="hidden" name="moreDestinations" value={JSON.stringify(moreDestinations.map(value => value.trim()).filter(Boolean))} />
      {destination.trim() && moreDestinations.length < 9 && <button type="button" onClick={() => { if (!moreDestinations.length && days && !stopDays[0]) setStopDays([days]); setMoreDestinations(current => [...current, '']) }} className="-mt-2 inline-flex items-center gap-1 text-sm font-semibold text-link"><Plus size={16} />Add another destination</button>}
      <label className="block"><span className="field-label">Trip name</span> <span className="text-xs text-muted">(optional)</span><input name="title" maxLength={160} placeholder="Summer in Italy" className={inputClass} /></label>
      <fieldset><legend className="field-label mb-2">{past ? 'Who was this trip with?' : 'Who is this trip for?'}</legend><input type="hidden" name="audience" value={audience} /><div className="flex flex-wrap gap-2">{([{ value: 'family', label: 'Family' }, { value: 'friends', label: 'Friends' }, { value: 'romantic', label: 'Couples' }, { value: 'adult', label: 'Adults' }] as const).map(option => <button key={option.value} type="button" aria-pressed={audience === option.value} onClick={() => setAudience(option.value)} className="chip">{option.label}</button>)}</div></fieldset>
      <details><summary className="flex cursor-pointer list-none items-center gap-3 py-2 text-sm text-link"><CalendarDays size={18} />{past ? 'When did you go? (optional)' : 'Add dates or number of days (optional)'}<ChevronDown size={18} className="ml-auto" /></summary>
        <div className="space-y-3 pt-1">
          {!multiStop && <label className="block text-sm">Number of days<input name="durationDays" type="number" inputMode="numeric" min={1} max={365} step={1} value={days} onChange={event => setDays(event.target.value)} placeholder="e.g. 5" className={inputClass} /></label>}
          {multiStop && <p className="text-sm text-muted">Add days next to each destination above.</p>}
          <p className="text-xs text-muted">Or pick dates:</p>
          <DateFields />
        </div>
      </details>
      <p className="flex items-start gap-3 rounded-xl bg-paper p-4 text-sm leading-relaxed text-link"><Compass size={28} className="mt-1 shrink-0" /><span>{past ? 'Add the hotels, restaurants and things you did. It stays private until you post it.' : 'Start with an idea. Save hotels, restaurants, and things to do as you find them. Your plan stays private until you share it.'}</span></p>
      <button type="submit" value="plan" className={`${buttonClass} w-full`}>{saving && !stage ? (past ? 'Saving your trip…' : 'Saving your plan…') : past ? 'Start filling it in →' : 'Start planning →'}</button>
    </fieldset>
    </div>
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
