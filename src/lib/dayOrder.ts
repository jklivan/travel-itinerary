// A sensible order for one day of a trip, for places without a set position: getting there first (flights, then the
// car rental or transfer), then the hotel, then meals in meal order. On the last day it's the other way round: the
// transfer and the flight home come last. A place with a time goes by its time; a place with no clear slot (most
// things to do) stays next to whatever it already follows.
export type DayPlace = { type: string; name: string; time?: string | null; mealType?: string | null }
type Day = { day: number; lastDay: number }

const MEALS: Record<string, number> = { breakfast: 8 * 60 + 30, coffee: 9 * 60, bakery: 10 * 60, lunch: 12 * 60 + 30, dessert: 15 * 60, drinks: 18 * 60, dinner: 19 * 60 + 30 }
const GROUND = /\b(car|rental|hire|transfer|taxi|shuttle|uber|lyft|driver|chauffeur|golf cart|scooter|bike|pick ?up|drop ?off)\b/i

// Minutes into the day where a place belongs, or null when there's no clear slot.
export function slotOf(place: DayPlace, { day, lastDay }: Day): number | null {
  if (place.time && /^\d{2}:\d{2}$/.test(place.time)) return Number(place.time.slice(0, 2)) * 60 + Number(place.time.slice(3))
  const leaving = day === lastDay && day > 1
  if (place.type === 'transport') return GROUND.test(place.name) ? (leaving ? 16 * 60 : 7 * 60) : (leaving ? 18 * 60 : 6 * 60)
  if (place.type === 'hotel') return 11 * 60
  if (place.type === 'food_drink' && place.mealType) {
    const slots = place.mealType.split(',').map(meal => MEALS[meal.trim()]).filter(slot => slot !== undefined)
    if (slots.length) return Math.min(...slots)
  }
  return null
}

// A place with no slot borrows the slot of the place before it, so it moves along with its neighbour.
function keyed<T extends DayPlace>(items: T[], day: Day) {
  let last = -1
  return items.map(item => { const slot = slotOf(item, day); if (slot !== null) last = slot; return { item, key: slot ?? last } })
}

// The whole day in a sensible order ("Sort this day"). Ties keep their current order.
export function sortDay<T extends DayPlace>(items: T[], day: Day): T[] {
  return keyed(items, day).map((entry, index) => ({ ...entry, index })).sort((a, b) => a.key - b.key || a.index - b.index).map(entry => entry.item)
}

// New places slotted into a day without moving the others (which may have been put in order by hand): each goes
// before the first existing place that belongs later in the day.
export function insertIntoDay<T extends DayPlace>(existing: T[], added: T[], day: Day): T[] {
  const result = [...existing]
  for (const item of sortDay(added, day)) {
    const slot = slotOf(item, day)
    const at = slot === null ? -1 : result.findIndex(other => { const otherSlot = slotOf(other, day); return otherSlot !== null && otherSlot > slot })
    if (at === -1) result.push(item); else result.splice(at, 0, item)
  }
  return result
}
