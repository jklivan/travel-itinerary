import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Heart, MessageCircle, Plane, UserPlus } from 'lucide-react'
import FollowBackButton from '@/components/FollowBackButton'
import { openNotification } from '@/actions/notifications'
import MarkNotificationsRead from '@/components/MarkNotificationsRead'
import { notificationText, forumNotificationWhere, forumReplyNotificationWhere } from '@/lib/notificationText'
import { NotificationPreferences } from '@/components/NativeNotifications'
import MessageRefresh from '@/components/MessageRefresh'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id, OR: [forumReplyNotificationWhere(session.user.id), forumNotificationWhere(session.user.id), { kind: 'message', messageId: { not: null } }, { kind: 'follow' }, { itinerary: { visibility: { not: 'draft' } } }] },
    include: { actor: { select: { name: true } }, itinerary: { select: { title: true } }, comment: { select: { content: true } } },
    orderBy: { createdAt: 'desc' }, take: 100,
  })
  // For "started following you": whether you already follow them back.
  const followerIds = notifications.filter(n => n.kind === 'follow').map(n => n.actorId)
  const followingBack = new Set(followerIds.length ? (await prisma.follow.findMany({ where: { followerId: session.user.id, followingId: { in: followerIds }, status: 'accepted' }, select: { followingId: true } })).map(f => f.followingId) : [])
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 className="type-display">Notifications</h1>
      <MarkNotificationsRead />
    </div>
    <NotificationPreferences />
    <MessageRefresh />
    {notifications.length === 0 ? <p className="panel p-6 text-muted">Forum posts, private messages, new trips from people you follow, and activity on your trips appear here.</p> :
      <ul className="overflow-hidden rounded-xl border border-line-soft divide-y divide-line-soft">
        {notifications.map(n => <li key={n.id} className={`flex items-center ${n.readAt ? 'bg-cream' : 'bg-card'}`}>
          <form action={openNotification} className="min-w-0 flex-1">
            <input type="hidden" name="id" value={n.id} />
            <button className="flex w-full items-start gap-3 p-4 text-left hover:bg-chip">
              {n.kind === 'follow' ? <UserPlus className="mt-1 shrink-0 text-link" size={20} /> : n.kind === 'published' ? <Plane className="mt-1 shrink-0 text-link" size={20} /> : (n.kind === 'forum_reply' || n.kind === 'forum' || n.kind === 'comment' || n.kind === 'message') ? <MessageCircle className="mt-1 shrink-0 text-link" size={20} /> : <Heart className="mt-1 shrink-0 text-terracotta" size={20} />}
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
      </ul>}
  </div>
}
