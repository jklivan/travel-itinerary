// The town part of an address, for place cards: "12 Main St, Norwalk, CT 06853, USA" → "Norwalk, CT, USA".
export function placeTown(address: string) {
  const parts = address.split(',').map(part => part.trim()).filter(Boolean)
  // Drop the street (the first part, when there's more after it) and postal codes.
  const rest = (parts.length > 2 ? parts.slice(1) : parts).map(part => part.split(/\s+/).filter(word => !/\d/.test(word)).join(' ')).filter(Boolean)
  return rest.join(', ') || address
}
