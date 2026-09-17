export function messageThreadHref(personId: string, itineraryId?: string | null) {
  return `/messages/${encodeURIComponent(personId)}${itineraryId ? `?trip=${encodeURIComponent(itineraryId)}` : ''}`
}
