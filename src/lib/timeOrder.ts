// A day's places with the timed ones in time order (flights, trains, reservations…), whichever way their times were
// entered (the time control, the edit form, an import). Timed places swap among the slots timed places hold, so
// untimed places keep their spots.
const timeOf = (item: unknown) => (item as { time?: string | null }).time ?? null
export function inTimeOrder<T>(items: T[]): T[] {
  const timed = items.filter(item => timeOf(item)).sort((a, b) => timeOf(a)!.localeCompare(timeOf(b)!))
  let next = 0
  return items.map(item => timeOf(item) ? timed[next++] : item)
}
