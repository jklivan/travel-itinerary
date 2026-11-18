const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall']

// When the person went, in their own seasons (the calendar's, as at home): a July trip is Summer wherever it was, even
// Sydney or Ecuador. (It used to flip south of the equator, so a July trip to Quito said Winter.)
export function tripSeason({ startDate, endDate, datesFlexible, postType, bestMonths = [] }: {
  startDate: Date; endDate: Date; datesFlexible?: boolean; postType: string; bestMonths?: string[]
}): string | null {
  let months: number[] = []
  if (postType === 'guide' || datesFlexible) {
    months = bestMonths.map(month => MONTHS.indexOf(month)).filter(month => month >= 0)
  } else {
    const start = new Date(startDate), end = new Date(endDate)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null
    const count = Math.min(12, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1)
    months = Array.from({ length: count }, (_, index) => (start.getUTCMonth() + index) % 12)
  }
  const seasons = [...new Set(months.map(month => SEASONS[Math.floor(((month + 1) % 12) / 3)]))]
  return seasons.length === 4 ? 'Year-round' : seasons.length ? seasons.join(' / ') : null
}
