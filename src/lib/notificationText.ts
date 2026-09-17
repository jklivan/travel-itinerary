import { messageThreadHref } from './messageThread'

export function notificationText(kind: string, actor: string, trip: string) {
  if (kind === 'forum_reply') return `${actor} replied to your forum question.`
  if (kind === 'forum') return `${actor} posted in Ask your friends.`
  if (kind === 'message') return `${actor} sent you a private message.`
  if (kind === 'published') return `${actor} posted a new trip: “${trip}”.`
  return `${actor} ${kind === 'comment' ? 'commented on' : 'saved'} your trip “${trip}”.`
}

export function notificationPath(itineraryId: string | null, kind: string, actorId?: string, questionId?: string | null) {
  if (kind === 'forum' || kind === 'forum_reply') return questionId ? `/explore/questions/${encodeURIComponent(questionId)}` : '/explore/questions'
  if (kind === 'message') return actorId ? messageThreadHref(actorId, itineraryId) : '/messages'
  if (!itineraryId) return '/notifications'
  return `/itinerary/${encodeURIComponent(itineraryId)}${kind === 'comment' ? '#comments' : ''}`
}

export function forumNotificationWhere(userId: string) {
  return { kind: 'forum', question: { author: { following: { some: { followingId: userId, status: 'accepted' } } } } }
}

export function forumReplyNotificationWhere(userId: string) {
  return { kind: 'forum_reply', questionReplyId: { not: null }, question: { authorId: userId } }
}
