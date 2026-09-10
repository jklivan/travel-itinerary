// Only accept an itinerary ID, never an arbitrary redirect URL.
export function saveTripId(value: unknown): string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : ''
}
