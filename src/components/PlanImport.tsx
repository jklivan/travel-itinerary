'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readFileForUpload, fetchExtraction } from '@/lib/importFiles'
import { importedPlaces, type ImportedPlace } from '@/lib/planImport'
import { importIntoPlan } from '@/actions/planImport'
import PlacesAutocomplete from './PlacesAutocomplete'
import { saveImportNotes } from '@/actions/importNotes'
import SavedImportNotes from './SavedImportNotes'
import { dateProblems, formatDate, tripDay, whenLabel } from '@/lib/placeDates'

// trip: the trip's dates, when it has them, for putting each booking on its day and spotting dates outside the trip.
export default function PlanImport({ tripId, destinations = [], trip = null, onClose }: { tripId: string; destinations?: { name: string; country: string | null }[]; trip?: { start: string; end: string } | null; onClose: () => void }) {
  const router = useRouter()
  const [text, setText] = useState('')
  // Every imported place goes under this destination (the trip's, to start). Each card then shows the
  // place's real town once Google has it, so places in nearby towns don't need their own headings.
  const [destination, setDestination] = useState<{ name: string; country: string | null } | null>(destinations[0] ?? null)
  const [typedDestination, setTypedDestination] = useState(destinations[0]?.name ?? '')
  // Several documents can be read at once (booking confirmations, reservation emails, PDFs…).
  const [files, setFiles] = useState<File[]>([])
  const file = files[0] ?? null
  // A trip without dates: offered the earliest to latest date in the documents.
  const [useDates, setUseDates] = useState(true)
  const [places, setPlaces] = useState<ImportedPlace[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [savedVersion, setSavedVersion] = useState(0)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const requestId = useRef('')
  useEffect(() => () => controller.current?.abort(), [])
  async function read() {
    if (busy.current) return
    busy.current = true; setError(''); setStage('Reading your file…')
    const abort = new AbortController(); controller.current = abort
    const chosen = destination ?? { name: typedDestination.trim(), country: null }
    const extract = async (payload: Parameters<typeof fetchExtraction>[0], label: string) => importedPlaces(await fetchExtraction({ ...payload, planning: true, tripDestinations: [chosen.country ? `${chosen.name} (${chosen.country})` : chosen.name] }, label, abort.signal))
      .map(place => ({ ...place, destination: chosen.name, country: chosen.country ?? '', near: { name: place.destination, country: place.country } }))
    try {
      const result: ImportedPlace[] = []
      const failed: string[] = []
      if (files.length) {
        // One document at a time; a document that can't be read doesn't stop the rest.
        for (const [index, current] of files.entries()) {
          if (abort.signal.aborted) throw Error('Import cancelled.')
          setStage(files.length > 1 ? `Reading ${index + 1} of ${files.length}: ${current.name}…` : 'Reading your file…')
          try {
            const payload = await readFileForUpload(current, abort.signal)
            if ('text' in payload) { const saved = await saveImportNotes(payload.text); if (!saved.error) setSavedVersion(value => value + 1) }
            result.push(...(await extract(payload, current.name)).map(place => ({ ...place, file: current.name })))
          } catch (err) { if (abort.signal.aborted) throw err; failed.push(current.name) }
        }
      } else {
        setStage('Saving your notes…')
        const saved = await saveImportNotes(text)
        if (saved.error) throw Error(saved.error)
        setSavedVersion(value => value + 1)
        setStage('Finding your places…')
        result.push(...await extract({ text }, 'your notes'))
      }
      if (abort.signal.aborted) throw Error('Import cancelled.')
      if (!result.length) throw Error(failed.length ? `Couldn’t read ${failed.join(', ')}. Please try again.` : 'No places found. Add a destination and place names to your notes, then try again.')
      if (result.length > 200) throw Error('Please split this into smaller imports of up to 200 places.')
      // Booked places in date and time order.
      result.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99'))
      setPlaces(result); setSelected(new Set(result.map((_, index) => index))); requestId.current = crypto.randomUUID(); setAttemptedSave(false)
      if (failed.length) setError(`Couldn’t read ${failed.join(', ')}. The places from the other ${files.length - failed.length === 1 ? 'document are' : 'documents are'} below.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read this import. Please try again.') }
    finally { busy.current = false; setStage(''); controller.current = null }
  }
  // Dates found in the documents. A trip without dates is offered the earliest to the latest of them.
  const dated = places.filter(place => place.date)
  const suggested = !trip && dated.length ? { start: dated.map(place => place.date!).sort()[0], end: dated.map(place => place.endDate ?? place.date!).sort().at(-1)! } : null
  const daysFrom = trip ?? (useDates ? suggested : null)
  const dayOf = (place: ImportedPlace) => daysFrom && place.date ? tripDay(place.date, daysFrom.start) : place.day
  const problems = dateProblems(places, trip)
  async function save() {
    if (busy.current || !selected.size) return
    busy.current = true; setStage('Adding places…'); setError(''); setAttemptedSave(true)
    try {
      const result = await importIntoPlan(tripId, requestId.current, places.filter((_, index) => selected.has(index)), !trip && useDates ? suggested : null)
      if (result.error) setError(result.error)
      else { router.refresh(); onClose() }
    } catch { setError('Could not save. Your review is still here; please try again.') }
    finally { busy.current = false; setStage('') }
  }
  return <section className="panel my-5 space-y-4 p-4" aria-label="Import into this trip">
    <div className="flex items-start justify-between gap-3"><div><h2 className="type-title">Add places from notes or files</h2><p className="mt-1 text-sm text-muted">Review the places, then add them to this trip. You can assign days whenever you’re ready.</p></div><button type="button" disabled={!!stage} onClick={onClose} className="min-h-11 px-2 text-sm text-link">Close</button></div>
    {!places.length ? <>
      <fieldset disabled={!!stage} className="space-y-4">
        <div className="space-y-2"><label className="block text-sm">Destination<PlacesAutocomplete required maxLength={160} value={typedDestination} onChange={value => { setTypedDestination(value); setDestination(destinations.find(d => d.name === value) ?? null) }} onSelect={(main, secondary) => { setTypedDestination([main, secondary].filter(Boolean).join(', ')); setDestination(null) }} type="destination" placeholder="City or area" className="field mt-2" /></label>
          {destinations.length > 1 && <div className="flex flex-wrap gap-2">{destinations.map(d => <button key={d.name} type="button" aria-pressed={destination?.name === d.name} onClick={() => { setDestination(d); setTypedDestination(d.name) }} className="chip">{d.name}</button>)}</div>}
          <p className="text-xs text-muted">Places from your notes are added here. Each one shows its own town once it’s found on Google.</p></div>
        <label className="block text-sm">Paste notes<textarea value={text} onChange={event => { setText(event.target.value); setFiles([]) }} maxLength={200000} rows={5} placeholder="Hotels, restaurants, activities…" className="field mt-2" /></label>
        <label className="block text-sm">Or choose files <span className="text-muted">(one or several: confirmations, reservation emails, PDFs…)</span><input key={files.map(f => f.name).join('|') || 'empty'} type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.html,.htm,image/jpeg,image/png,image/gif,image/webp" onChange={event => setFiles(Array.from(event.target.files ?? []).slice(0, 20))} className="mt-2 block w-full min-w-0 text-sm" /></label>
        {files.length > 0 && <p className="break-words text-xs text-muted">Selected: {files.map(f => f.name).join(', ')}</p>}
        <button type="button" disabled={(!file && !text.trim()) || !typedDestination.trim()} onClick={() => void read()} className="btn btn-primary w-full">{typedDestination.trim() ? 'Find places' : 'Add a destination first'}</button>
      </fieldset>
      <SavedImportNotes refreshKey={savedVersion} disabled={!!stage} onRestore={value => { setText(value); setFiles([]) }} />
    </> : <>
      {suggested && <label className="panel-hint flex items-start gap-3 p-3 text-sm"><input type="checkbox" checked={useDates} onChange={event => setUseDates(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
        <span>Set the trip’s dates to <strong>{formatDate(suggested.start)} – {formatDate(suggested.end)}</strong> ({tripDay(suggested.end, suggested.start)} days), from these bookings, so each one goes on its day.</span></label>}
      {problems.some(Boolean) && <p role="status" className="text-sm text-danger">{problems.filter(Boolean).length === 1 ? 'One place has' : `${problems.filter(Boolean).length} places have`} a date to check. Untick anything that doesn’t belong, or fix it after adding.</p>}
      <p className="text-sm font-medium">{selected.size} places selected</p>
      <fieldset disabled={!!stage || attemptedSave} className="max-h-[50dvh] space-y-3 overflow-y-auto">
        {places.map((place, index) => <label key={index} className="flex items-start gap-3 rounded-xl border border-line p-3"><input type="checkbox" checked={selected.has(index)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(index); else next.delete(index); return next })} className="mt-1 h-5 w-5 shrink-0" /><span className="min-w-0 break-words"><strong className="block text-sm">{place.name}</strong><span className="block text-xs text-muted">{[whenLabel(place), dayOf(place) ? `Day ${dayOf(place)}` : 'Unscheduled', place.nights ? `${place.nights} ${place.nights === 1 ? 'night' : 'nights'}` : ''].filter(Boolean).join(' · ')}</span>
          {problems[index] && <span className="mt-1 block text-xs font-semibold text-danger">{problems[index]}</span>}
          {files.length > 1 && place.file && <span className="block text-xs text-muted">From {place.file}</span>}{place.notes && <span className="mt-1 block whitespace-pre-wrap text-sm">{place.notes}</span>}</span></label>)}
      </fieldset>
      <p className="text-xs text-muted">Your existing places, dates, and sharing settings stay the same.</p>
      <button type="button" disabled={!!stage || !selected.size} onClick={() => void save()} className="btn btn-primary w-full">{stage === 'Adding places…' ? stage : `Add ${selected.size} places to this trip`}</button>
      {!attemptedSave && <button type="button" disabled={!!stage} onClick={() => { setPlaces([]); setError('') }} className="min-h-11 text-sm text-link">Back to import</button>}
    </>}
    {stage && <div role="status" className="text-sm text-link">{stage}{stage !== 'Adding places…' && <button type="button" onClick={() => controller.current?.abort()} className="ml-3 min-h-11 underline">Cancel</button>}</div>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </section>
}
