import { TAGS } from './tags'

export const TRIP_TYPES = [
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
  { id: 'friends', label: 'Friends', emoji: '🥳' },
  { id: 'romantic', label: 'Couples', emoji: '💕' },
  { id: 'adult', label: 'Adults', emoji: '🍷' },
] as const

function selection(value: string | undefined, allowed: readonly string[]) {
  return [...new Set((value ?? '').split(',').filter(id => allowed.includes(id)))]
}

export function parseExploreFilters(types?: string, tags?: string, location?: string) {
  return {
    types: selection(types, TRIP_TYPES.map(type => type.id)),
    tags: selection(tags, TAGS.map(tag => tag.id)),
    location: location?.trim() ?? '',
  }
}

export function exploreFilterWhere(filters: { types: string[]; tags: string[]; location: string }) {
  return {
    ...(filters.types.length ? { audience: { in: filters.types } } : {}),
    ...(filters.tags.length ? { tags: { hasSome: filters.tags } } : {}),
    ...(filters.location ? {
      destinations: {
        some: {
          OR: [
            { name: { contains: filters.location, mode: 'insensitive' as const } },
            { country: { contains: filters.location, mode: 'insensitive' as const } },
          ],
        },
      },
    } : {}),
  }
}
