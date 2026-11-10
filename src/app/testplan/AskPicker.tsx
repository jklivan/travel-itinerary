'use client'

import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, Minus, Plus } from 'lucide-react'
import DateRangeCalendar from '@/components/ui/DateRangeCalendar'
import { daysBetween, formatDate } from '@/lib/placeDates'
import type { UsualTravelers } from '@/lib/usualTravelers'

// What the planner's question offers instead of typing: chips to choose from, travel dates, or who's going.
export type Ask = { kind: 'none' | 'choose' | 'dates' | 'guests' | 'dates_and_guests' | 'trip_basics'; question: string; options: string[]; multiple: boolean }

// "trip_basics": a new traveler's three starting questions at once.
const TRIP_TYPES = ['Beach', 'City', 'Mountains', 'Countryside', 'Islands', 'Snow & ski', 'Wine country', 'Adventure']
const BUDGETS = ['$ Budget-friendly', '$$ Mid-range', '$$$ Upscale', '$$$$ Luxury']
const WHO = [['Solo', 'Just me'], ['Couple', 'Couple'], ['Family with kids', 'Family with kids'], ['Friends', 'Friends']] as const

const longDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const list = (items: (string | number)[]) => items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : String(items[0] ?? '')

// Under the planner's latest question: tap an answer instead of typing it. The answer is sent as a message.
export default function AskPicker({ ask, usual = null, disabled, waiting = false, onAnswer: send }: { ask: Ask; usual?: UsualTravelers | null; disabled: boolean; waiting?: boolean; onAnswer: (text: string) => void }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  // Answered while the reply is still finishing: it's sent as soon as it's done.
  const [answered, setAnswered] = useState('')
  const onAnswer = (text: string) => { setAnswered(text); send(text) }
  const [picked, setPicked] = useState<string[]>([])
  const [basics, setBasics] = useState<Record<string, string[]>>({})
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [start, setStart] = useState(''), [end, setEnd] = useState('')
  // When: exact dates, roughly when ("Late June"), or not sure yet. Without exact dates, how long is a number of days
  // or left to Postcard to suggest.
  const [when, setWhen] = useState<'dates' | 'month' | 'unsure' | ''>('')
  const months = useState(() => Array.from({ length: 13 }, (_, index) => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + index); return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }))[0]
  const [month, setMonth] = useState(''), [part, setPart] = useState('')
  const [days, setDays] = useState('')
  // Who's going starts as last time's group (children a year older each year), so it's usually just Continue.
  const [adults, setAdults] = useState(usual?.adults ?? 2)
  const [children, setChildren] = useState<number[]>(usual?.childAges ?? [])
  const wantsDates = ask.kind === 'dates' || ask.kind === 'dates_and_guests'
  // Answered while the reply is still being written: says it's waiting, and goes once that's done.
  if (answered) return <p role="status" className="text-xs text-muted">{waiting ? `Sending “${answered.length > 60 ? `${answered.slice(0, 57)}…` : answered}” when Postcard finishes…` : 'Sending…'}</p>
  const wantsGuests = ask.kind === 'guests' || ask.kind === 'dates_and_guests'

  if (ask.kind === 'trip_basics') {
    const chip = (group: string, value: string, label: string, many: boolean) => {
      const chosen = basics[group]?.includes(value) ?? false
      return <button key={value} type="button" aria-pressed={chosen} onClick={() => setBasics(current => ({ ...current, [group]: many ? (chosen ? current[group].filter(item => item !== value) : [...(current[group] ?? []), value]) : chosen ? [] : [value] }))} className="chip">{chosen && many && <Check size={14} />}{label}</button>
    }
    const types = basics.types ?? [], budget = basics.budget?.[0], who = basics.who?.[0]
    const answer = [types.length && `${list(types)} trip`, budget && `${budget} budget`, who && (who === 'Solo' ? 'just me' : who === 'Couple' ? 'for a couple' : who === 'Friends' ? 'with friends' : 'for a family with kids')].filter(Boolean).join(', ')
    return <div className="panel-inset space-y-4 p-3">
      <fieldset><legend className="mb-2 text-sm font-semibold">What kind of trip? <span className="font-normal text-muted">(pick any)</span></legend><div className="flex flex-wrap gap-2">{TRIP_TYPES.map(value => chip('types', value, value, true))}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Budget</legend><div className="flex flex-wrap gap-2">{BUDGETS.map(value => chip('budget', value, value, false))}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Who’s going?</legend><div className="flex flex-wrap gap-2">{WHO.map(([value, label]) => chip('who', value, label, false))}</div></fieldset>
      <button type="button" disabled={disabled || !answer} onClick={() => onAnswer(answer.charAt(0).toUpperCase() + answer.slice(1) + '.')} className="btn btn-primary btn-sm">Continue<ArrowRight size={16} /></button>
    </div>
  }
  if (ask.kind === 'choose' && ask.options.length) return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">{ask.options.map(option => ask.multiple
      ? <button key={option} type="button" disabled={disabled} aria-pressed={picked.includes(option)} onClick={() => setPicked(list => list.includes(option) ? list.filter(item => item !== option) : [...list, option])} className="chip">{picked.includes(option) && <Check size={14} />}{option}</button>
      : <button key={option} type="button" disabled={disabled} onClick={() => onAnswer(option)} className="chip">{option}</button>)}</div>
    {ask.multiple && <button type="button" disabled={disabled || !picked.length} onClick={() => onAnswer(list(picked))} className="btn btn-primary btn-sm">Continue<ArrowRight size={16} /></button>}
  </div>
  if (!wantsDates && !wantsGuests) return null

  const nights = start && end ? daysBetween(start, end) : 0
  const datesText = start && end ? `${longDate(start)} to ${longDate(end)}` : ''
  const guestsText = `${adults} ${adults === 1 ? 'adult' : 'adults'}${children.length ? ` and ${children.length} ${children.length === 1 ? 'child' : 'children'} (${children.length === 1 ? 'age' : 'ages'} ${list(children)})` : ''}`
  const length = Number(days) >= 1 && Number(days) <= 60 ? `${Number(days)} ${Number(days) === 1 ? 'day' : 'days'}` : 'not sure how long, so suggest the ideal length'
  const whenText = when === 'dates' ? datesText
    : when === 'month' && month ? `Going ${part ? `${part.toLowerCase()} ` : ''}${month}, ${length}`
    : when === 'unsure' ? `Not sure when yet, ${length}` : ''
  const ready = (!wantsDates || !!whenText) && !disabled
  return <div className="panel-inset space-y-4 p-3">
    {wantsDates && <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={when === 'dates'} onClick={() => { setWhen('dates'); setCalendarOpen(open => when !== 'dates' || !open) }} aria-expanded={calendarOpen} className="chip"><CalendarDays size={14} />{when === 'dates' && datesText ? `${formatDate(start)} – ${formatDate(end)} · ${nights} ${nights === 1 ? 'night' : 'nights'}` : when === 'dates' && start ? `${formatDate(start)} – choose the last day` : 'Exact dates'}</button>
        <button type="button" aria-pressed={when === 'month'} onClick={() => { setWhen('month'); setCalendarOpen(false) }} className="chip">{when === 'month' && <Check size={14} />}Roughly when</button>
        <button type="button" aria-pressed={when === 'unsure'} onClick={() => { setWhen('unsure'); setCalendarOpen(false) }} className="chip">{when === 'unsure' && <Check size={14} />}Not sure yet</button>
      </div>
      {when === 'dates' && calendarOpen && <div className="max-w-xs"><DateRangeCalendar start={start} end={end} min={today} onChange={(first, last) => { setStart(first); setEnd(last); if (last) setCalendarOpen(false) }} /></div>}
      {when === 'month' && <div className="flex flex-wrap gap-2">
        <label className="text-xs text-muted">Part of the month<select value={part} onChange={event => setPart(event.target.value)} className="field mt-1 w-32"><option value="">Any time</option><option>Early</option><option>Mid</option><option>Late</option></select></label>
        <label className="text-xs text-muted">Month<select value={month} onChange={event => setMonth(event.target.value)} className="field mt-1 w-44"><option value="">Choose…</option>{months.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>}
      {(when === 'month' || when === 'unsure') && <label className="block text-xs text-muted">How many days? <span className="font-normal">(leave empty and Postcard suggests the ideal length)</span>
        <input type="number" inputMode="numeric" min={1} max={60} value={days} onChange={event => setDays(event.target.value)} placeholder="Not sure" className="field mt-1 w-28" /></label>}
    </div>}
    {wantsGuests && <div className="space-y-3">
      <Stepper label="Adults" value={adults} min={1} max={12} onChange={setAdults} />
      <Stepper label="Children" value={children.length} min={0} max={8} onChange={count => setChildren(list => count > list.length ? [...list, 8] : list.slice(0, count))} />
      {children.length > 0 && <div className="flex flex-wrap gap-2">{children.map((age, index) => <label key={index} className="text-xs text-muted">Child {index + 1} age
        <select value={age} onChange={event => setChildren(list => list.map((value, i) => i === index ? Number(event.target.value) : value))} className="field mt-1 w-20">
          {Array.from({ length: 18 }, (_, value) => <option key={value} value={value}>{value}</option>)}
        </select></label>)}</div>}
    </div>}
    <button type="button" disabled={!ready} onClick={() => onAnswer([whenText, wantsGuests && guestsText].filter(Boolean).join(', '))} className="btn btn-primary btn-sm">Continue<ArrowRight size={16} /></button>
  </div>
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <div className="flex items-center justify-between gap-3 text-sm">
    <span>{label}</span>
    <span className="flex items-center gap-3">
      <button type="button" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`} className="btn-icon"><Minus size={16} /></button>
      <span className="w-5 text-center font-semibold" aria-live="polite">{value}</span>
      <button type="button" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`} className="btn-icon"><Plus size={16} /></button>
    </span>
  </div>
}
