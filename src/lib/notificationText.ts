import { messageThreadHref } from './messageThread'

export function notificationText(kind: string, actor: string, trip: string) {
  // Trips and places that came in by email or from an AI assistant (lib/importNotice).
  if (kind === 'trip_imported') return `Your trip “${trip}” arrived in Postcard.`
  if (kind === 'places_imported') return `New places were added to “${trip}”.`
  if (kind === 'forum_reply') return `${actor} replied to your forum question.`
  if (kind === 'forum') return `${actor} posted in Ask your friends.`
  if (kind === 'message') return `${actor} sent you a private message.`
  if (kind === 'follow') return `${actor} started following you.`
  if (kind === 'published') return `${actor} posted a new trip: “${trip}”.`
  if (kind === 'trip_invite') return `${actor} invited you to plan “${trip}” together.`
  if (kind === 'trip_joined') return `${actor} joined your trip “${trip}”.`
  if (kind === 'trip_chat') return `${actor} wrote in the chat for “${trip}”.`
  return `${actor} ${kind === 'comment' ? 'commented on' : kind === 'like' ? 'liked' : 'saved'} your trip “${trip}”.`
}

export function notificationPath(itineraryId: string | null, kind: string, actorId?: string, questionId?: string | null) {
  if (kind === 'forum' || kind === 'forum_reply') return questionId ? `/explore/questions/${encodeURIComponent(questionId)}` : '/explore/questions'
  if (kind === 'message') return actorId ? messageThreadHref(actorId, itineraryId) : '/messages'
  if (kind === 'follow') return actorId ? `/user/${encodeURIComponent(actorId)}` : '/friends'
  if (!itineraryId) return '/notifications'
  // Group trips: an invite opens the join page; someone joining opens the plan.
  if (kind === 'trip_invite') return `/join/${encodeURIComponent(itineraryId)}`
  if (kind === 'trip_joined' || kind === 'trip_imported' || kind === 'places_imported') return `/plan/${encodeURIComponent(itineraryId)}`
  if (kind === 'trip_chat') return `/plan/${encodeURIComponent(itineraryId)}#trip-chat`
  // Someone reacting to your trip: open it as others see it (with its comments and likes). Your own trips otherwise
  // open in the planner; people's other trips ignore ?as=guest.
  const guest = ['comment', 'like', 'save'].includes(kind) ? '?as=guest' : ''
  return `/itinerary/${encodeURIComponent(itineraryId)}${guest}${kind === 'comment' ? '#comments' : ''}`
}

export function forumNotificationWhere(userId: string) {
  return { kind: 'forum', question: { author: { following: { some: { followingId: userId, status: 'accepted' } } } } }
}

export function forumReplyNotificationWhere(userId: string) {
  return { kind: 'forum_reply', questionReplyId: { not: null }, question: { authorId: userId } }
}
