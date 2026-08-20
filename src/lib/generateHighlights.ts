type Item = {
  type: string
  name: string
  rating: number | null
  notes: string | null
  mealType?: string | null
}

type Dest = {
  name: string
  country: string | null
  items: Item[]
}

function topRated(items: Item[], n: number): Item[] {
  if (items.length === 0) return []
  // Shuffle first so ties are broken randomly, then stable-sort by rating desc
  const shuffled = items.slice().sort(() => Math.random() - 0.5)
  shuffled.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  return shuffled.slice(0, n)
}

export async function generateHighlights(
  _tripTitle: string,
  destinations: Dest[]
): Promise<string | null> {
  const allItems = destinations.flatMap(d => d.items)

  const food = allItems.filter(i => i.type === 'food_drink' && i.name.trim() && (i.rating ?? 0) > 0)
  const activities = allItems.filter(i => i.type === 'activity' && i.name.trim() && (i.rating ?? 0) > 0)

  const picks = [...topRated(food, 2), ...topRated(activities, 2)]

  return picks.length > 0 ? picks.map(i => i.name.trim()).join('\n') : null
}
