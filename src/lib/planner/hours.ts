// Opening hours from Google Places (regularOpeningHours.periods, plus specialDays for holidays in the coming week):
// whether a place is open on a given date, and at a given time. Days are 0 = Sunday … 6 = Saturday, as Google gives
// them; times are the place's own local time.
export type Point = { day: number; hour: number; minute: number }
export type Period = { open: Point; close?: Point }

const minutes = (point: Point) => point.day * 1440 + point.hour * 60 + point.minute
const WEEK = 7 * 1440
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

// Open around the clock: one period that opens on day 0 at 00:00 and never closes.
const allDay = (periods: Period[]) => periods.length === 1 && !periods[0].close && minutes(periods[0].open) === 0

// Each period as [start, end) minutes into the week; ones that run past Saturday night wrap to the start.
function ranges(periods: Period[]) {
  return periods.flatMap(period => {
    if (!period.close) return [[minutes(period.open), minutes(period.open) + 1440] as const]
    const start = minutes(period.open)
    let end = minutes(period.close)
    if (end <= start) end += WEEK
    return end > WEEK ? [[start, WEEK] as const, [0, end - WEEK] as const] : [[start, end] as const]
  })
}

// Open at that moment (date and HH:MM, local time).
export function openAt(periods: Period[], date: string, time: string) {
  if (allDay(periods)) return true
  const at = weekday(date) * 1440 + Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  return ranges(periods).some(([start, end]) => at >= start && at < end)
}

// The times it's open on that date, e.g. "12:00–15:00, 19:00–23:30" (or null when closed all day).
export function hoursOn(periods: Period[], date: string) {
  if (allDay(periods)) return 'Open 24 hours'
  const day = weekday(date), dayStart = day * 1440, dayEnd = dayStart + 1440
  const clock = (value: number) => { const m = ((value % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
  // Each period whole (not split at the end of the week), so Saturday's late night still shows its real close.
  const whole = periods.map(period => { const start = minutes(period.open), close = period.close ? minutes(period.close) : start + 1440; return [start, close <= start ? close + WEEK : close] as const })
  const spans = whole.filter(([start]) => start >= dayStart && start < dayEnd).sort((a, b) => a[0] - b[0])
    // A span that runs past midnight shows its real closing time ("19:00–02:00").
    .map(([start, end]) => `${clock(Math.max(start, dayStart))}–${clock(end)}`)
  return spans.length ? spans.join(', ') : null
}

export const dayName = (date: string) => DAYS[weekday(date)]
