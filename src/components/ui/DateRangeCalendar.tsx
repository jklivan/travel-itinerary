'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays } from '@/lib/placeDates'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const iso = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)

// Pick a first and last day on a month calendar, like booking a flight: tap the first day, then the last.
// Days before `min` (today, usually) can't be picked. Dates are "YYYY-MM-DD".
export default function DateRangeCalendar({ start, end, min, onChange }: { start: string; end: string; min: string; onChange: (start: string, end: string) => void }) {
  const first = start || min
  const [month, setMonth] = useState({ year: Number(first.slice(0, 4)), month: Number(first.slice(5, 7)) - 1 })
  const days = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate()
  const lead = new Date(Date.UTC(month.year, month.month, 1)).getUTCDay()
  const title = new Date(Date.UTC(month.year, month.month, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const move = (offset: number) => setMonth(current => { const date = new Date(Date.UTC(current.year, current.month + offset, 1)); return { year: date.getUTCFullYear(), month: date.getUTCMonth() } })
  const canGoBack = iso(month.year, month.month, 1) > min.slice(0, 8) + '01'
  function pick(day: string) {
    // A first tap (or a tap before the first day) starts again; the next one sets the last day.
    if (!start || end || day < start) onChange(day, '')
    else onChange(start, day === start ? addDays(day, 1) : day)
  }
  return <div className="select-none">
    <div className="mb-2 flex items-center justify-between">
      <button type="button" disabled={!canGoBack} onClick={() => move(-1)} aria-label="Previous month" className="btn-icon"><ChevronLeft size={18} /></button>
      <p className="text-sm font-semibold text-ink" aria-live="polite">{title}</p>
      <button type="button" onClick={() => move(1)} aria-label="Next month" className="btn-icon"><ChevronRight size={18} /></button>
    </div>
    <div className="grid grid-cols-7 text-center text-xs text-muted" aria-hidden="true">{WEEKDAYS.map((day, index) => <span key={index} className="py-1">{day}</span>)}</div>
    <div className="grid grid-cols-7 gap-y-1">
      {Array.from({ length: lead }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: days }, (_, index) => {
        const day = iso(month.year, month.month, index + 1)
        const chosen = day === start || day === end
        return <button key={day} type="button" disabled={day < min} onClick={() => pick(day)} aria-pressed={chosen} data-between={!!start && !!end && day > start && day < end}
          aria-label={new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })} className="calendar-day">{index + 1}</button>
      })}
    </div>
  </div>
}
