// Only accept an itinerary ID, never an arbitrary redirect URL.
export function saveTripId(value: unknown): string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : ''
}

// After signing in, back to an assistant's "Connect … to Postcard?" page; only that page, never another address.
export function oauthReturn(value: unknown): string {
  return typeof value === 'string' && value.length <= 4000 && value.startsWith('/oauth/authorize?') && !/[\\\s]/.test(value) ? value : ''
}
