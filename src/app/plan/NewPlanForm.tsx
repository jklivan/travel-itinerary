'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Compass, CalendarDays, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { copyStoryToPlan } from '@/actions/stories'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import { startPlan, copyPlaceToPlan } from '@/actions/planning'

export const inputClass = 'mt-1 w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3 text-sm text-ink'
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
  const [style, setStyle] = useState<'days' | 'ideas'>('days')
  const [days, setDays] = useState('')
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
  }} className="panel space-y-5 p-4 sm:p-6">
    {(savePlace || saveStory) && <p className="text-sm text-link">We’ll add the place you selected to this new plan.</p>}
    <fieldset disabled={saving} className="space-y-5">
      {/* Two ways to plan: day by day (asks how many days, so places can go on a day right away), or just
          collecting ideas (a guide). One day is saved as a day trip. */}
      <fieldset>
        <legend className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink">How do you want to plan?</legend>
        <input type="hidden" name="format" value={style === 'ideas' ? 'guide' : days === '1' ? 'day-trip' : 'itinerary'} />
        <div className="mx-auto grid max-w-[270px] grid-cols-2 gap-4 py-2">
          {[
            { value: 'days', label: 'Plan day by day', hint: 'A day-by-day itinerary', photo: 'photo-1435527173128-983b87201f4d', tilt: 'rotate-[-3deg]' },
            { value: 'ideas', label: 'Start collecting ideas', hint: 'Places & ideas', photo: 'photo-1499793983690-e29da59ef1c2', tilt: 'rotate-[3deg]' },
          ].map(option => <button key={option.value} type="button" aria-pressed={style === option.value} onClick={() => setStyle(option.value as 'days' | 'ideas')} className={`${option.tilt} min-w-0 rounded-lg border bg-card p-1.5 pb-3 shadow-md sm:p-2 ${style === option.value ? 'border-link ring-2 ring-link/20' : 'border-line-soft'}`}>
            <span className="block aspect-[4/3] rounded bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/${option.photo}?auto=format&fit=crop&w=480&q=85)` }} />
            <span className="mt-2 block text-[11px] font-semibold uppercase leading-tight tracking-wide text-ink sm:text-sm">{option.label}</span>
            <span className="mt-1 block text-[8px] uppercase tracking-wide text-link sm:text-[9px]">{option.hint}</span>
          </button>)}
        </div>
        {style === 'days' && <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.16em] text-link">How many days?
          <input name="durationDays" type="number" inputMode="numeric" min={1} max={365} step={1} required value={days} onChange={event => setDays(event.target.value)} placeholder="e.g. 5" className={inputClass} />
        </label>}
      </fieldset>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-link">Where are you thinking?<PlacesAutocomplete name="destination" value={destination} onChange={setDestination} onSelect={(main, secondary) => setDestination([main, secondary].filter(Boolean).join(', '))} type="destination" maxLength={160} placeholder="e.g. Italy, Japan, a weekend away…" className={inputClass} /></label>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-link">Trip name <span className="font-normal normal-case tracking-normal">(optional)</span><input name="title" maxLength={160} placeholder="Summer in Italy" className={inputClass} /></label>
      <fieldset><legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-link">Who is this trip for?</legend><input type="hidden" name="audience" value={audience} /><div className="flex flex-wrap gap-2">{([{ value: 'family', label: 'Family' }, { value: 'friends', label: 'Friends' }, { value: 'romantic', label: 'Couples' }, { value: 'adult', label: 'Adults' }] as const).map(option => <button key={option.value} type="button" aria-pressed={audience === option.value} onClick={() => setAudience(option.value)} className="chip">{option.label}</button>)}</div></fieldset>
      <details><summary className="flex cursor-pointer list-none items-center gap-3 py-2 text-sm text-link"><CalendarDays size={20} />Add dates (optional)<ChevronDown size={18} className="ml-auto" /></summary><DateFields /></details>
      <p className="flex items-start gap-3 rounded-xl bg-[#f0f1eb] p-4 text-sm leading-relaxed text-link"><Compass size={26} className="mt-1 shrink-0" /><span>Start with an idea. Save hotels, restaurants, and things to do as you find them. Your plan stays private until you share it.</span></p>
      <button type="submit" value="plan" className={`${buttonClass} w-full`}>{saving ? 'Saving your plan…' : 'Start planning →'}</button>
      <button type="submit" value="import" className="btn btn-outline w-full">Import notes or a file</button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {error && createdPlan && <Link href={`/plan/${createdPlan}`} className="block text-sm text-link underline">Open your saved plan →</Link>}
  </form>
}

export function DateFields({ start = '', end = '' }: { start?: string; end?: string }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block min-w-0 text-sm">Start date<input name="startDate" type="date" defaultValue={start} className={inputClass} /></label>
    <label className="block min-w-0 text-sm">End date<input name="endDate" type="date" defaultValue={end} className={inputClass} /></label>
  </div>
}
