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

export async function generateHighlights(
  _tripTitle: string,
  destinations: Dest[]
): Promise<string | null> {
  const lines = destinations.flatMap((d) => {
    const loc = `${d.name}${d.country ? `, ${d.country}` : ''}`
    return d.items
      .filter((i) => i.rating !== null && i.rating >= 4)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .map((i) => {
        const emoji = i.type === 'hotel' ? '🏨' : i.type === 'food_drink' ? '🍽️' : '📍'
        return `${emoji} ${i.name} (${loc})`
      })
  })

  return lines.length > 0 ? lines.join('\n') : null
}
