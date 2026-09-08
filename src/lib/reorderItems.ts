type DayItem = { id: string; dayIndex: number }

/** Transfer one event; all other events retain their day and relative order. */
export function moveItemToDay<T extends DayItem>(
  items: T[], activeId: string, day: number, overId?: string, after = false,
): T[] {
  const active = items.find(item => item.id === activeId)
  if (!active || activeId === overId) return items
  const remaining = items.filter(item => item.id !== activeId)
  let index: number
  if (overId !== undefined) {
    index = remaining.findIndex(item => item.id === overId && item.dayIndex === day)
    if (index < 0) return items
    if (after) index++
  } else {
    const last = remaining.map(item => item.dayIndex).lastIndexOf(day)
    index = last < 0 ? remaining.length : last + 1
  }
  remaining.splice(index, 0, { ...active, dayIndex: day })
  return remaining
}

/** Reorder only the selected day's slots, leaving other days untouched. */
export function reorderItems<T extends DayItem>(
  items: T[],
  activeId: string,
  overId: string,
  day?: number,
): T[] {
  const scoped = day === undefined ? items : items.filter(item => item.dayIndex === day)
  const from = scoped.findIndex(item => item.id === activeId)
  const to = scoped.findIndex(item => item.id === overId)
  if (from < 0 || to < 0 || from === to) return items

  const reordered = [...scoped]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(to, 0, moved)
  let index = 0
  return items.map(item => day === undefined || item.dayIndex === day ? reordered[index++] : item)
}
