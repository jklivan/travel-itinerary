export function notificationText(kind: string, actor: string, trip: string) {
  if (kind === 'published') return `${actor} posted a new trip: “${trip}”.`
  return `${actor} ${kind === 'comment' ? 'commented on' : 'saved'} your trip “${trip}”.`
}

export function notificationPath(itineraryId: string, kind: string) {
  return `/itinerary/${encodeURIComponent(itineraryId)}${kind === 'comment' ? '#comments' : ''}`
}
