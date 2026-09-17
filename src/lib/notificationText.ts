import { messageThreadHref } from './messageThread'

export function notificationText(kind: string, actor: string, trip: string) {
  if (kind === 'message') return `${actor} sent you a private message.`
  if (kind === 'published') return `${actor} posted a new trip: “${trip}”.`
  return `${actor} ${kind === 'comment' ? 'commented on' : 'saved'} your trip “${trip}”.`
}

export function notificationPath(itineraryId: string | null, kind: string, actorId?: string) {
  if (kind === 'message') return actorId ? messageThreadHref(actorId, itineraryId) : '/messages'
  if (!itineraryId) return '/notifications'
  return `/itinerary/${encodeURIComponent(itineraryId)}${kind === 'comment' ? '#comments' : ''}`
}
