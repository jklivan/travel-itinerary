'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readFileForUpload, fetchExtraction } from '@/lib/importFiles'
import { importedPlaces, type ImportedPlace } from '@/lib/planImport'
import { importIntoPlan } from '@/actions/planImport'
import PlacesAutocomplete from './PlacesAutocomplete'
import { saveImportNotes } from '@/actions/importNotes'
import SavedImportNotes from './SavedImportNotes'

export default function PlanImport({ tripId, destinations = [], onClose }: { tripId: string; destinations?: { name: string; country: string | null }[]; onClose: () => void }) {
  const router = useRouter()
  const [text, setText] = useState('')
  // Every imported place goes under this destination (the trip's, to start). Each card then shows the
  // place's real town once Google has it, so places in nearby towns don't need their own headings.
  const [destination, setDestination] = useState<{ name: string; country: string | null } | null>(destinations[0] ?? null)
  const [typedDestination, setTypedDestination] = useState(destinations[0]?.name ?? '')
  const [file, setFile] = useState<File | null>(null)
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
    try {
      const payload = file ? await readFileForUpload(file, abort.signal) : { text }
      if ('text' in payload) {
        setStage('Saving your notes…')
        const saved = await saveImportNotes(payload.text)
        if (saved.error) throw Error(saved.error)
        setSavedVersion(value => value + 1)
      }
      if (abort.signal.aborted) throw Error('Import cancelled.')
      setStage('Finding your places…')
      const chosen = destination ?? { name: typedDestination.trim(), country: null }
      const result = importedPlaces(await fetchExtraction({ ...payload, planning: true, tripDestinations: [chosen.country ? `${chosen.name} (${chosen.country})` : chosen.name] }, file?.name ?? 'your notes', abort.signal))
        .map(place => ({ ...place, destination: chosen.name, country: chosen.country ?? '', near: { name: place.destination, country: place.country } }))
      if (!result.length) throw Error('No places found. Add a destination and place names to your notes, then try again.')
      if (result.length > 200) throw Error('Please split this into smaller imports of up to 200 places.')
      setPlaces(result); setSelected(new Set(result.map((_, index) => index))); requestId.current = crypto.randomUUID(); setAttemptedSave(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read this import. Please try again.') }
    finally { busy.current = false; setStage(''); controller.current = null }
  }
  async function save() {
    if (busy.current || !selected.size) return
    busy.current = true; setStage('Adding places…'); setError(''); setAttemptedSave(true)
    try {
      const result = await importIntoPlan(tripId, requestId.current, places.filter((_, index) => selected.has(index)))
      if (result.error) setError(result.error)
      else { router.refresh(); onClose() }
    } catch { setError('Could not save. Your review is still here; please try again.') }
    finally { busy.current = false; setStage('') }
  }
  return <section className="panel my-5 space-y-4 p-4" aria-label="Import into this trip">
    <div className="flex items-start justify-between gap-3"><div><h2 className="type-title">Add places from notes or a file</h2><p className="mt-1 text-sm text-muted">Review the places, then add them to this trip. You can assign days whenever you’re ready.</p></div><button type="button" disabled={!!stage} onClick={onClose} className="min-h-11 px-2 text-sm text-link">Close</button></div>
    {!places.length ? <>
      <fieldset disabled={!!stage} className="space-y-4">
        <div className="space-y-2"><label className="block text-sm">Destination<PlacesAutocomplete required maxLength={160} value={typedDestination} onChange={value => { setTypedDestination(value); setDestination(destinations.find(d => d.name === value) ?? null) }} onSelect={(main, secondary) => { setTypedDestination([main, secondary].filter(Boolean).join(', ')); setDestination(null) }} type="destination" placeholder="City or area" className="field mt-2" /></label>
          {destinations.length > 1 && <div className="flex flex-wrap gap-2">{destinations.map(d => <button key={d.name} type="button" aria-pressed={destination?.name === d.name} onClick={() => { setDestination(d); setTypedDestination(d.name) }} className="chip">{d.name}</button>)}</div>}
          <p className="text-xs text-muted">Places from your notes are added here. Each one shows its own town once it’s found on Google.</p></div>
        <label className="block text-sm">Paste notes<textarea value={text} onChange={event => { setText(event.target.value); setFile(null) }} maxLength={200000} rows={5} placeholder="Hotels, restaurants, activities…" className="field mt-2" /></label>
        <label className="block text-sm">Or choose a file<input key={file?.name ?? 'empty'} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.html,.htm,image/jpeg,image/png,image/gif,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full min-w-0 text-sm" /></label>
        {file && <p className="break-words text-xs text-muted">Selected: {file.name}</p>}
        <button type="button" disabled={(!file && !text.trim()) || !typedDestination.trim()} onClick={() => void read()} className="btn btn-primary w-full">{typedDestination.trim() ? 'Find places' : 'Add a destination first'}</button>
      </fieldset>
      <SavedImportNotes refreshKey={savedVersion} disabled={!!stage} onRestore={value => { setText(value); setFile(null) }} />
    </> : <>
      <p className="text-sm font-medium">{selected.size} places selected</p>
      <fieldset disabled={!!stage || attemptedSave} className="max-h-[50dvh] space-y-3 overflow-y-auto">
        {places.map((place, index) => <label key={index} className="flex items-start gap-3 rounded-xl border border-line p-3"><input type="checkbox" checked={selected.has(index)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(index); else next.delete(index); return next })} className="mt-1 h-5 w-5 shrink-0" /><span className="min-w-0 break-words"><strong className="block text-sm">{place.name}</strong><span className="block text-xs text-muted">{[place.destination, place.country].filter(Boolean).join(', ')} · {place.day ? `Day ${place.day}` : 'Unscheduled'}</span>{place.notes && <span className="mt-1 block whitespace-pre-wrap text-sm">{place.notes}</span>}</span></label>)}
      </fieldset>
      <p className="text-xs text-muted">Your existing places, dates, and sharing settings stay the same.</p>
      <button type="button" disabled={!!stage || !selected.size} onClick={() => void save()} className="btn btn-primary w-full">{stage === 'Adding places…' ? stage : `Add ${selected.size} places to this trip`}</button>
      {!attemptedSave && <button type="button" disabled={!!stage} onClick={() => { setPlaces([]); setError('') }} className="min-h-11 text-sm text-link">Back to import</button>}
    </>}
    {stage && <div role="status" className="text-sm text-link">{stage}{stage !== 'Adding places…' && <button type="button" onClick={() => controller.current?.abort()} className="ml-3 min-h-11 underline">Cancel</button>}</div>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </section>
}
