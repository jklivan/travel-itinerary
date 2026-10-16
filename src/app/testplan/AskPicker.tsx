'use client'

import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, Minus, Plus } from 'lucide-react'
import DateRangeCalendar from '@/components/ui/DateRangeCalendar'
import { daysBetween, formatDate } from '@/lib/placeDates'

// What the planner's question offers instead of typing: chips to choose from, travel dates, or who's going.
export type Ask = { kind: 'none' | 'choose' | 'dates' | 'guests' | 'dates_and_guests'; question: string; options: string[]; multiple: boolean }

const longDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const list = (items: (string | number)[]) => items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : String(items[0] ?? '')

// Under the planner's latest question: tap an answer instead of typing it. The answer is sent as a message.
export default function AskPicker({ ask, disabled, onAnswer: send }: { ask: Ask; disabled: boolean; onAnswer: (text: string) => void }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  // Answered while the reply is still finishing: it's sent as soon as it's done.
  const [answered, setAnswered] = useState(false)
  const onAnswer = (text: string) => { setAnswered(true); send(text) }
  const [picked, setPicked] = useState<string[]>([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [start, setStart] = useState(''), [end, setEnd] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState<number[]>([])
  const wantsDates = ask.kind === 'dates' || ask.kind === 'dates_and_guests'
  if (answered) return <p className="text-xs text-muted">Sending…</p>
  const wantsGuests = ask.kind === 'guests' || ask.kind === 'dates_and_guests'

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
  const ready = (!wantsDates || !!datesText) && !disabled
  return <div className="panel-inset space-y-4 p-3">
    {wantsDates && <div>
      <button type="button" onClick={() => setCalendarOpen(open => !open)} aria-expanded={calendarOpen} className="btn btn-outline btn-sm"><CalendarDays size={16} />{datesText ? `${formatDate(start)} – ${formatDate(end)} · ${nights} ${nights === 1 ? 'night' : 'nights'}` : start ? `${formatDate(start)} – choose the last day` : 'Choose dates'}</button>
      {calendarOpen && <div className="mt-3 max-w-xs"><DateRangeCalendar start={start} end={end} min={today} onChange={(first, last) => { setStart(first); setEnd(last); if (last) setCalendarOpen(false) }} /></div>}
    </div>}
    {wantsGuests && <div className="space-y-3">
      <Stepper label="Adults" value={adults} min={1} max={12} onChange={setAdults} />
      <Stepper label="Children" value={children.length} min={0} max={8} onChange={count => setChildren(list => count > list.length ? [...list, 8] : list.slice(0, count))} />
      {children.length > 0 && <div className="flex flex-wrap gap-2">{children.map((age, index) => <label key={index} className="text-xs text-muted">Child {index + 1} age
        <select value={age} onChange={event => setChildren(list => list.map((value, i) => i === index ? Number(event.target.value) : value))} className="field mt-1 w-20">
          {Array.from({ length: 18 }, (_, value) => <option key={value} value={value}>{value}</option>)}
        </select></label>)}</div>}
    </div>}
    <button type="button" disabled={!ready} onClick={() => onAnswer([datesText, wantsGuests && guestsText].filter(Boolean).join(', '))} className="btn btn-primary btn-sm">Continue<ArrowRight size={16} /></button>
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
