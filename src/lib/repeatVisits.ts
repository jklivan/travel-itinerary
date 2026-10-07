// A place visited more than once (e.g. the same beach club on day 2 and day 5) is saved once per visit. The trip's
// Summary shows it once, with everything from every visit: notes, tags and photos combined. Day by day still shows each visit.

type Visit = {
  id: string; type: string; name: string; placeId?: string | null; dayIndex?: number | null
  notes?: string | null; description?: string | null; tags?: string[]; photoUrls?: string[]; photoUrl?: string | null
  rating?: number | null; priceLevel?: number | null; familyFriendly?: boolean | null; address?: string | null; link?: string | null
  mealType?: string | null; lat?: number | null; lng?: number | null
}

const words = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// Same Google place, or the same kind of place with the same name.
export const visitKey = (visit: Pick<Visit, 'type' | 'name' | 'placeId'>) => visit.placeId ? `place:${visit.placeId}` : `${visit.type}:${words(visit.name)}`

const unique = <T,>(values: (T | null | undefined)[]) => [...new Set(values.filter((value): value is T => value != null && value !== ''))]
const joinText = (values: (string | null | undefined)[]) => unique(values.map(value => value?.trim())).join('\n') || null

export function mergeRepeatVisits<T extends Visit>(visits: readonly T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const visit of visits) {
    // Same name but a different Google place is a different place; a visit without an ID joins one with the same name.
    const byName = `${visit.type}:${words(visit.name)}`
    const key = visit.placeId ? visitKey(visit) : [...groups.keys()].find(existing => existing.startsWith('place:') && groups.get(existing)![0].type === visit.type && words(groups.get(existing)![0].name) === words(visit.name)) ?? byName
    const group = groups.get(key) ?? groups.get(byName)
    if (group) group.push(visit); else groups.set(key, [visit])
  }
  return [...groups.values()].map(group => {
    if (group.length === 1) return group[0]
    const first = group[0]
    const photos = unique(group.flatMap(visit => [...(visit.photoUrls ?? []), visit.photoUrl]))
    const ratings = unique(group.map(visit => visit.rating))
    return {
      ...first,
      notes: joinText(group.map(visit => visit.notes)),
      description: joinText(group.map(visit => visit.description)),
      tags: unique(group.flatMap(visit => visit.tags ?? [])),
      photoUrls: photos,
      photoUrl: photos[0] ?? null,
      // The best rating they gave it; other details from the first visit that has them.
      rating: ratings.length ? Math.max(...ratings) : null,
      priceLevel: first.priceLevel ?? group.find(visit => visit.priceLevel != null)?.priceLevel ?? null,
      familyFriendly: first.familyFriendly ?? group.find(visit => visit.familyFriendly != null)?.familyFriendly ?? null,
      address: first.address || group.find(visit => visit.address)?.address || null,
      link: first.link || group.find(visit => visit.link)?.link || null,
      mealType: first.mealType || group.find(visit => visit.mealType)?.mealType || null,
      placeId: first.placeId || group.find(visit => visit.placeId)?.placeId || null,
      lat: first.lat ?? group.find(visit => visit.lat != null)?.lat ?? null,
      lng: first.lng ?? group.find(visit => visit.lng != null)?.lng ?? null,
    }
  })
}
