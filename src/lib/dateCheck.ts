// A place whose emailed or imported booking says another day or time than the trip has it on (DestItem.dateCheck,
// set by actions/planImport). The app asks which is right when it opens (components/DateCheckPrompt).
export type DateCheck = { date: string | null; time: string | null; day: number | null }
export type When = { date: string | null; time: string | null; day: number | null }

export function asDateCheck(value: unknown): DateCheck | null {
  if (!value || typeof value !== 'object') return null
  const { date, time, day } = value as Record<string, unknown>
  return { date: typeof date === 'string' ? date : null, time: typeof time === 'string' ? time : null, day: typeof day === 'number' ? day : null }
}

const clock = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${hours < 12 ? 'am' : 'pm'}`
}

// "Mon, Dec 22 at 6:30 pm", "Day 3", or just the time. start: the trip's first day, to put a date on a day number.
export function describeWhen(when: When, start: string | null, withTime = true) {
  const date = when.date ?? (start && when.day ? new Date(Date.parse(`${start}T00:00:00Z`) + (when.day - 1) * 86_400_000).toISOString().slice(0, 10) : null)
  const day = date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : when.day ? `Day ${when.day}` : ''
  const time = withTime && when.time ? clock(when.time) : ''
  return day && time ? `${day} at ${time}` : day || time
}
