export type ImportedPlace = { name: string; destination: string; country: string; type: string; notes: string; day: number | null; rating: number | null; mealType: string }
export function importedPlaces(data: unknown): ImportedPlace[] {
  if (!data || typeof data !== 'object' || !('destinations' in data) || !Array.isArray(data.destinations)) return []
  return data.destinations.flatMap(destination => {
    if (!destination || typeof destination.name !== 'string' || !Array.isArray(destination.items)) return []
    return destination.items.flatMap((item: Record<string, unknown>) => {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || !['hotel', 'food_drink', 'activity'].includes(String(item.type))) return []
      return [{ name: item.name.trim(), destination: destination.name.trim(), country: typeof destination.country === 'string' ? destination.country : '', type: String(item.type), notes: typeof item.notes === 'string' ? item.notes : '', day: item.type !== 'hotel' && Number.isInteger(item.dayIndex) && Number(item.dayIndex) > 0 && Number(item.dayIndex) <= 365 ? Number(item.dayIndex) : null, rating: Number.isInteger(item.rating) && Number(item.rating) >= 1 && Number(item.rating) <= 5 ? Number(item.rating) : null, mealType: typeof item.mealType === 'string' ? item.mealType : '' }]
    })
  })
}
