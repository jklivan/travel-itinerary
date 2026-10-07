import { prisma } from '@/lib/prisma'
import { Heart, MessageCircle, Plane, UserPlus } from 'lucide-react'
import { openNotification } from '@/actions/notifications'
import FollowBackButton from '@/components/FollowBackButton'
import { notificationText, forumNotificationWhere, forumReplyNotificationWhere } from '@/lib/notificationText'

// Which notifications someone can see. Alerts (on Profile) leave out private messages and replies to your
// questions, which have their own badge on Messages.
export function notificationWhere(userId: string, alertsOnly = false) {
  const kinds = alertsOnly
    ? [forumNotificationWhere(userId), { kind: 'follow' }, { kind: { notIn: ['message', 'forum', 'forum_reply'] }, itinerary: { visibility: { not: 'draft' } } }]
    : [forumReplyNotificationWhere(userId), forumNotificationWhere(userId), { kind: 'message', messageId: { not: null } }, { kind: 'follow' }, { itinerary: { visibility: { not: 'draft' } } }]
  return { recipientId: userId, OR: kinds }
}

// The list of notifications (newest first). Unread ones are brighter with a blue dot; "started following you" has Follow back.
export default async function NotificationList({ userId, alertsOnly = false, take = 100, empty }: { userId: string; alertsOnly?: boolean; take?: number; empty: string }) {
  const notifications = await prisma.notification.findMany({
    where: notificationWhere(userId, alertsOnly),
    include: { actor: { select: { name: true } }, itinerary: { select: { title: true } }, comment: { select: { content: true } } },
    orderBy: { createdAt: 'desc' }, take,
  })
  // For "started following you": whether you already follow them back.
  const followerIds = notifications.filter(n => n.kind === 'follow').map(n => n.actorId)
  const followingBack = new Set(followerIds.length ? (await prisma.follow.findMany({ where: { followerId: userId, followingId: { in: followerIds }, status: 'accepted' }, select: { followingId: true } })).map(f => f.followingId) : [])
  if (notifications.length === 0) return <p className="panel-dashed p-6 text-center text-sm text-muted">{empty}</p>
  return <ul className="panel divide-y divide-line-soft overflow-hidden">
    {notifications.map(n => <li key={n.id} className={`flex items-center ${n.readAt ? 'bg-cream' : 'bg-card'}`}>
      <form action={openNotification} className="min-w-0 flex-1">
        <input type="hidden" name="id" value={n.id} />
        <button className="flex w-full items-start gap-3 p-4 text-left hover:bg-chip">
          {n.kind === 'follow' ? <UserPlus className="mt-1 shrink-0 text-link" size={18} /> : n.kind === 'published' ? <Plane className="mt-1 shrink-0 text-link" size={18} /> : (n.kind === 'forum_reply' || n.kind === 'forum' || n.kind === 'comment' || n.kind === 'message') ? <MessageCircle className="mt-1 shrink-0 text-link" size={18} /> : <Heart className="mt-1 shrink-0 text-terracotta" size={18} />}
          <span className="min-w-0 flex-1">
            <span className={`block text-sm text-ink ${n.readAt ? '' : 'font-semibold'}`}>{notificationText(n.kind, n.actor.name, n.itinerary?.title ?? '')}</span>
            {n.comment && <span className="mt-1 block line-clamp-2 text-sm text-muted">{n.comment.content}</span>}
            <time className="mt-2 block text-xs text-muted" dateTime={n.createdAt.toISOString()}>{n.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time>
          </span>
          {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-link" aria-label="Unread" />}
        </button>
      </form>
      {n.kind === 'follow' && <div className="pr-4"><FollowBackButton userId={n.actorId} name={n.actor.name} initialFollowing={followingBack.has(n.actorId)} /></div>}
    </li>)}
  </ul>
}
