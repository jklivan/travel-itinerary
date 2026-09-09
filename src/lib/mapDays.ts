const DAY_COLORS = ['#2563eb', '#c2410c', '#15803d', '#7e22ce', '#be123c', '#0e7490', '#a16207', '#4338ca', '#047857', '#a21caf', '#9f1239', '#334155']

export function mapDayNumber(dayIndex: number | null | undefined, zeroBased = false): number | null {
  if (dayIndex == null || !Number.isInteger(dayIndex) || dayIndex < 0) return null
  return Math.max(1, dayIndex + (zeroBased ? 1 : 0))
}

export function mapDayColor(day: number | null): string {
  if (day === null) return '#64748b'
  return DAY_COLORS[day - 1] ?? `hsl(${Math.round(day * 137.508) % 360}, 65%, 35%)`
}
