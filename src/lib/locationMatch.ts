// Matching a searched place ("California", "Nantucket", "USA") against trip destinations, which are stored the way
// Google writes them: "Los Olivos, CA, USA", or a name plus a country like "Boston" / "MA, USA".
// So a US state matches by its name or its two-letter code, and the United States by any of its usual names.

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
}
const STATE_BY_CODE = Object.fromEntries(Object.entries(US_STATES).map(([name, code]) => [code, name]))
const US_NAMES = ['united states', 'united states of america', 'usa', 'us', 'u.s.', 'u.s.a.', 'america']

type Text = { contains?: string; startsWith?: string; endsWith?: string; equals?: string; mode?: 'insensitive' }
export type DestinationMatch = { name: Text } | { country: Text }

// A short code (CA, USA) only counts as a whole part of the address, never inside a word (Cancún, Busan).
function codeConditions(code: string): DestinationMatch[] {
  return (['name', 'country'] as const).flatMap(field => [
    { [field]: { contains: `, ${code},` } }, { [field]: { endsWith: `, ${code}` } }, { [field]: { startsWith: `${code},` } }, { [field]: { equals: code } },
  ] as DestinationMatch[])
}
function textConditions(text: string): DestinationMatch[] {
  return [{ name: { contains: text, mode: 'insensitive' } }, { country: { contains: text, mode: 'insensitive' } }]
}

// Prisma conditions (any of them) for one destination to match one searched place.
export function locationConditions(term: string): DestinationMatch[] {
  const text = term.trim()
  if (!text) return []
  const lower = text.toLocaleLowerCase()
  if (US_NAMES.includes(lower)) return [...textConditions('United States'), ...codeConditions('USA'), ...codeConditions('US')]
  const stateCode = US_STATES[lower]
  if (stateCode) return [...textConditions(text), ...codeConditions(stateCode)]
  if (/^[A-Za-z]{2}$/.test(text) && STATE_BY_CODE[text.toUpperCase()]) return [...textConditions(STATE_BY_CODE[text.toUpperCase()]), ...codeConditions(text.toUpperCase())]
  return textConditions(text)
}
