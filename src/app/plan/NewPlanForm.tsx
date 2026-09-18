'use client'

import TripFormatPicker, { type TripFormat } from '@/components/TripFormatPicker'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { copyStoryToPlan } from '@/actions/stories'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import { startPlan, copyPlaceToPlan } from '@/actions/planning'

export const inputClass = 'mt-1 w-full min-w-0 rounded-xl border border-[#d7cebc] bg-white px-3 py-3 text-base text-[#2e4147]'
export const buttonClass = 'min-h-11 rounded-xl bg-[#242e25] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50'

export default function NewPlanForm({ savePlace, saveStory }: { savePlace?: string; saveStory?: string }) {
  const router = useRouter()
  const clientId = useRef('')
  const placeCopyId = useRef('')
  const busy = useRef(false)
  const [createdPlan, setCreatedPlan] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [format, setFormat] = useState<TripFormat>('guide')
  const [destination, setDestination] = useState('')
  return <form onSubmit={async event => {
    event.preventDefault()
    if (busy.current) return
    busy.current = true; setSaving(true); setError('')
    if (!clientId.current) clientId.current = crypto.randomUUID()
    const importing = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'import'
    const data = new FormData(event.currentTarget)
    if (importing && !String(data.get('title') ?? '').trim() && !String(data.get('destination') ?? '').trim()) data.set('title', 'My trip')
    data.set('clientId', clientId.current)
    try {
      const result = await startPlan(data)
      if (result.error) setError(result.error)
      else if (result.id) {
        setCreatedPlan(result.id)
        if (savePlace || saveStory) {
          if (!placeCopyId.current) placeCopyId.current = crypto.randomUUID()
          const copied = saveStory ? await copyStoryToPlan(saveStory, result.id, placeCopyId.current) : await copyPlaceToPlan(savePlace!, result.id, placeCopyId.current)
          if (copied.error) { setError(`Your plan was saved, but the place couldn’t be added. ${copied.error}`); return }
        }
        router.push(`/plan/${result.id}${importing ? '?import=1' : ''}`); router.refresh()
      }
    } catch { setError('Could not save. Your details are still here; please try again.') }
    finally { busy.current = false; setSaving(false) }
  }} className="space-y-4 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-5">
    {(savePlace || saveStory) && <p className="text-sm text-[#59694f]">We’ll add the place you selected to this new plan.</p>}
    <fieldset disabled={saving} className="space-y-4">
      <TripFormatPicker value={format} onChange={setFormat} />
      <input type="hidden" name="format" value={format} />
      {format === 'day-trip' && <input type="hidden" name="durationDays" value="1" />}
      {format === 'itinerary' && <label className="block text-sm font-medium">Number of days (optional)<input name="durationDays" type="number" min="2" step="1" className={inputClass} placeholder="Or add a daily schedule later" /></label>}
      <label className="block text-sm font-medium">Where are you thinking?<PlacesAutocomplete name="destination" value={destination} onChange={setDestination} onSelect={(main, secondary) => setDestination([main, secondary].filter(Boolean).join(', '))} type="destination" maxLength={160} placeholder="e.g. Italy, Japan, a weekend away…" className={inputClass} /></label>
      <label className="block text-sm font-medium">Trip name <span className="font-normal">(optional)</span><input name="title" maxLength={160} placeholder="Summer in Italy" className={inputClass} /></label>
      <details><summary className="cursor-pointer py-2 text-sm text-[#59694f]">Add dates (optional)</summary><DateFields /></details>
      <p className="text-sm text-[#73786d]">Start with an idea. Save hotels, restaurants, and things to do as you find them. Your plan stays private until you share it.</p>
      <button type="submit" value="plan" className={`${buttonClass} w-full`}>{saving ? 'Saving your plan…' : 'Start planning'}</button>
      <button type="submit" value="import" className="min-h-11 w-full rounded-xl border border-[#d7cebc] px-5 py-3 text-sm font-semibold text-[#59694f] disabled:opacity-50">Import notes or a file</button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {error && createdPlan && <Link href={`/plan/${createdPlan}`} className="block text-sm text-[#59694f] underline">Open your saved plan →</Link>}
  </form>
}

export function DateFields({ start = '', end = '' }: { start?: string; end?: string }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block min-w-0 text-sm">Start date<input name="startDate" type="date" defaultValue={start} className={inputClass} /></label>
    <label className="block min-w-0 text-sm">End date<input name="endDate" type="date" defaultValue={end} className={inputClass} /></label>
  </div>
}
