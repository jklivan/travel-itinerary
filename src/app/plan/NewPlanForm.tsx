'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Compass, CalendarDays, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { copyStoryToPlan } from '@/actions/stories'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import { startPlan, copyPlaceToPlan } from '@/actions/planning'

export const inputClass = 'mt-1 w-full min-w-0 rounded-xl border border-[#d7cebc] bg-[#fffdf7] px-3 py-3 text-sm text-[#2e4147]'
export const buttonClass = 'min-h-11 rounded-xl bg-[#2e4147] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50'

export default function NewPlanForm({ savePlace, saveStory }: { savePlace?: string; saveStory?: string }) {
  const router = useRouter()
  const clientId = useRef('')
  const placeCopyId = useRef('')
  const busy = useRef(false)
  const [createdPlan, setCreatedPlan] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [destination, setDestination] = useState('')
  const [format, setFormat] = useState('itinerary')
  const [audience, setAudience] = useState('family')
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
        router.push(`/plan/${result.id}${importing ? '?import=1' : ''}`)
      }
    } catch { setError('Could not save. Your details are still here; please try again.') }
    finally { busy.current = false; setSaving(false) }
  }} className="space-y-5 rounded-2xl border border-[#e1d8c9] bg-[#fffdf7]/80 p-4 sm:p-6">
    {(savePlace || saveStory) && <p className="text-sm text-[#59694f]">We’ll add the place you selected to this new plan.</p>}
    <fieldset disabled={saving} className="space-y-5">
      <fieldset>
        <legend className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2e4147]">What are you planning?</legend>
        <input type="hidden" name="format" value={format} />
        <div className="grid grid-cols-3 gap-3 py-2">
          {[
            { value: 'guide', label: 'Guide', hint: 'Places & ideas', photo: 'photo-1499793983690-e29da59ef1c2', tilt: 'rotate-[-4deg]' },
            { value: 'day-trip', label: 'Day trip', hint: 'A short getaway', photo: 'photo-1449965408869-eaa3f722e40d', tilt: 'rotate-[-2deg]' },
            { value: 'itinerary', label: 'Multi-day trip', hint: 'A longer journey', photo: 'photo-1436491865332-7a61a109cc05', tilt: 'rotate-[4deg]' },
          ].map(option => <button key={option.value} type="button" aria-pressed={format === option.value} onClick={() => setFormat(option.value)} className={`${option.tilt} min-w-0 rounded-lg border bg-[#fffdf7] p-1.5 pb-3 shadow-md sm:p-2 ${format === option.value ? 'border-[#59694f] ring-2 ring-[#59694f]/20' : 'border-[#e1d8c9]'}`}>
            <span className="block aspect-[3/4] rounded bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/${option.photo}?auto=format&fit=crop&w=480&q=85)` }} />
            <span className="mt-2 block text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#2e4147] sm:text-sm">{option.label}</span>
            <span className="mt-1 block text-[7px] uppercase tracking-wide text-[#59694f] sm:text-[9px]">{option.hint}</span>
          </button>)}
        </div>
      </fieldset>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#59694f]">Where are you thinking?<PlacesAutocomplete name="destination" value={destination} onChange={setDestination} onSelect={(main, secondary) => setDestination([main, secondary].filter(Boolean).join(', '))} type="destination" maxLength={160} placeholder="e.g. Italy, Japan, a weekend away…" className={inputClass} /></label>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#59694f]">Trip name <span className="font-normal normal-case tracking-normal">(optional)</span><input name="title" maxLength={160} placeholder="Summer in Italy" className={inputClass} /></label>
      <fieldset><legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#59694f]">Who is this trip for?</legend><input type="hidden" name="audience" value={audience} /><div className="flex flex-wrap gap-2">{([{ value: 'family', label: 'Family' }, { value: 'friends', label: 'Friends' }, { value: 'romantic', label: 'Couples' }, { value: 'adult', label: 'Adults' }] as const).map(option => <button key={option.value} type="button" onClick={() => setAudience(option.value)} className={`min-h-10 rounded-full border px-4 text-sm text-[#59694f] ${audience === option.value ? 'border-[#59694f] bg-[#e8eee8] font-semibold' : 'border-[#d7cebc]'}`}>{option.label}</button>)}</div></fieldset>
      <details><summary className="flex cursor-pointer list-none items-center gap-3 py-2 text-sm text-[#59694f]"><CalendarDays size={20} />Add dates (optional)<ChevronDown size={18} className="ml-auto" /></summary><DateFields /></details>
      <p className="flex items-start gap-3 rounded-xl bg-[#f0f1eb] p-4 text-sm leading-relaxed text-[#59694f]"><Compass size={26} className="mt-1 shrink-0" /><span>Start with an idea. Save hotels, restaurants, and things to do as you find them. Your plan stays private until you share it.</span></p>
      <button type="submit" value="plan" className={`${buttonClass} w-full rounded-2xl bg-[#242e25]`}>{saving ? 'Saving your plan…' : 'Start planning →'}</button>
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
