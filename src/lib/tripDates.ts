export function dateRangeFromMonthAndDays(month: string, days: string) {
  const dayCount = Number(days)
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(dayCount) || dayCount < 1) {
    return { startDate: '', endDate: '' }
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNumber - 1, 1))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + dayCount - 1)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

export function monthAndDaysFromDates(startDate?: string, endDate?: string) {
  const month = startDate?.slice(0, 7) ?? ''
  if (!startDate || !endDate) return { month, days: '' }
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00Z`)
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00Z`)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
  return { month, days: String(days) }
}

export function tripDetailsError(title: string, postType: string, month: string, days: string): string | null {
  if (!title.trim()) return 'Add a trip title to continue.'
  if (postType === 'guide') return null
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 'Choose the month of your trip to continue.'
  const count = Number(days)
  if (!Number.isInteger(count) || count < 1) return 'Enter a positive whole number of days.'
  return null
}
