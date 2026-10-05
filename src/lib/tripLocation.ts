import { samePlanDestination } from './planPlaceIdentity'

type Destination = { name: string; country?: string | null }

// Street names in addresses, so a venue saved as a destination ("Gettó Gulyás, Budapest, Wesselényi Street" in Hungary,
// or "Story of Soil" at "San Marcos Avenue, Los Olivos, CA, USA") can be shown as its town instead.
// Whole street words only: short forms like CT or UT are also US state codes, and numbers can be postcodes.
const STREET = /(^|\s)(street|avenue|ave|road|lane|drive|boulevard|blvd|highway|hwy|square|parkway|pkwy|terrace|alley|utca|út|tér|via|viale|piazza|corso|rue|avenida|calle|carrer|rua|strasse|straße|weg|platz|gasse|laan|straat|gracht|plein)(\s|\.|$)/i
const isStreet = (part: string) => STREET.test(part)

// The town a destination is in: the destination itself when it's a town, or the town part of a venue's address.
export function destinationTown(destination: Destination): string {
  const name = destination.name.trim()
  const country = destination.country?.trim() ?? ''
  const parts = [name, country].filter(Boolean).join(', ').split(',').map(part => part.trim()).filter(Boolean)
  const venue = parts.slice(1).some(isStreet)
  if (!venue) return country && !name.includes(country) ? `${name}, ${country}` : name
  // A venue: drop its own name (the first part) and the street, keep town, state and country.
  const town = parts.slice(1).filter(part => !isStreet(part))
  return town.length ? town.join(', ') : name
}

// A trip's location line (trip page header, trip cards): its first town, then "& more…" if it has others.
// The same town saved twice (e.g. "Antibes" and "Antibes, France", or two restaurants in Budapest) counts once,
// and the planner's placeholder is skipped.
export function tripLocationLabel(destinations: Destination[]): string | null {
  const towns: string[] = []
  for (const destination of destinations) {
    if (!destination.name.trim() || destination.name === 'Destination to decide') continue
    const town = destinationTown(destination)
    if (!towns.some(existing => samePlanDestination({ name: existing }, { name: town }))) towns.push(town)
  }
  if (!towns.length) return null
  return towns.length > 1 ? `${towns[0]} & more…` : towns[0]
}
