// Reading the planner's "who's going" answer ("2 adults and 3 children (ages 5, 8 and 10)"). Safe for the browser;
// lib/usualTravelers finds the last one someone gave.
export type UsualTravelers = { adults: number; childAges: number[] }

const ANSWER = /(\d{1,2}) adults?(?: and (\d) (?:child|children) \((?:age|ages) ([\d, and]+)\))?/

export function readTravelers(text: string): UsualTravelers | null {
  const match = ANSWER.exec(text)
  if (!match) return null
  const adults = Number(match[1])
  const childAges = match[3] ? match[3].split(/,\s*|\s+and\s+/).map(Number).filter(age => Number.isInteger(age) && age >= 0 && age < 18) : []
  return adults >= 1 && adults <= 12 && childAges.length === Number(match[2] ?? 0) ? { adults, childAges } : null
}

export const describeTravelers = (usual: UsualTravelers) => `${usual.adults} ${usual.adults === 1 ? 'adult' : 'adults'}${usual.childAges.length ? ` and ${usual.childAges.length} ${usual.childAges.length === 1 ? 'child' : 'children'} (${usual.childAges.length === 1 ? 'age' : 'ages'} ${usual.childAges.join(', ')})` : ''}`
