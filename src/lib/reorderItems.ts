type DayItem = { id: string; dayIndex: number }

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
