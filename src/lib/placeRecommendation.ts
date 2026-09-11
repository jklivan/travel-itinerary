export type PlaceRecommendation = 'none' | 'must' | 'avoid' | 'option'

export function getRecommendation(tags: readonly string[] = [], isHighlight = false): PlaceRecommendation {
  if (tags.includes('__option')) return 'option'
  if (tags.includes('__avoid')) return 'avoid'
  // Only explicit selections count; legacy labels and automatic picks do not.
  return isHighlight || tags.includes('__highlight') ? 'must' : 'none'
}

export function recommendationTags(tags: readonly string[] = [], recommendation: PlaceRecommendation): string[] {
  const otherTags = tags.filter(tag => tag !== '__option' && tag !== '__highlight' && tag !== '__avoid' && tag !== 'Must-Do')
  if (recommendation === 'none') return otherTags
  return [...otherTags, recommendation === 'option' ? '__option' : recommendation === 'must' ? '__highlight' : '__avoid']
}
