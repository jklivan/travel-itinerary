export type PlaceRecommendation = 'none' | 'must' | 'avoid'

export function getRecommendation(tags: readonly string[] = [], isHighlight = false): PlaceRecommendation {
  if (tags.includes('__avoid')) return 'avoid'
  // Only explicit selections count; legacy labels and automatic picks do not.
  return isHighlight || tags.includes('__highlight') ? 'must' : 'none'
}

export function recommendationTags(tags: readonly string[] = [], recommendation: PlaceRecommendation): string[] {
  const otherTags = tags.filter(tag => tag !== '__highlight' && tag !== '__avoid' && tag !== 'Must-Do')
  if (recommendation === 'none') return otherTags
  return [...otherTags, recommendation === 'must' ? '__highlight' : '__avoid']
}
