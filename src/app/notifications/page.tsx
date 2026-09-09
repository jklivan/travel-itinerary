import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Heart, MessageCircle } from 'lucide-react'
import { openNotification } from '@/actions/notifications'
import MarkNotificationsRead from '@/components/MarkNotificationsRead'
import { notificationText } from '@/lib/notificationText'
import { NotificationPreferences } from '@/components/NativeNotifications'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id, itinerary: { visibility: { not: 'draft' } } },
    include: { actor: { select: { name: true } }, itinerary: { select: { title: true } }, comment: { select: { content: true } } },
    orderBy: { createdAt: 'desc' }, take: 100,
  })
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-[#2e4147]">Notifications</h1>
      <MarkNotificationsRead />
    </div>
    <NotificationPreferences />
    {notifications.length === 0 ? <p className="rounded-xl border border-[#e3dfd2] bg-[#fffdf6] p-6 text-[#6b7067]">When someone comments on or saves your trip, you’ll see it here.</p> :
      <ul className="overflow-hidden rounded-xl border border-[#e3dfd2] divide-y divide-[#e3dfd2]">
        {notifications.map(n => <li key={n.id} className={n.readAt ? 'bg-[#faf7ee]' : 'bg-[#fffdf6]'}>
          <form action={openNotification}>
            <input type="hidden" name="id" value={n.id} />
            <button className="flex w-full items-start gap-3 p-4 text-left hover:bg-[#eee7d9]">
              {n.kind === 'comment' ? <MessageCircle className="mt-1 shrink-0 text-[#507c76]" size={20} /> : <Heart className="mt-1 shrink-0 text-[#ad6b57]" size={20} />}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm text-[#2e4147] ${n.readAt ? '' : 'font-semibold'}`}>{notificationText(n.kind, n.actor.name, n.itinerary.title)}</span>
                {n.comment && <span className="mt-1 block line-clamp-2 text-sm text-[#6b7067]">{n.comment.content}</span>}
                <time className="mt-2 block text-xs text-[#7a7b70]" dateTime={n.createdAt.toISOString()}>{n.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time>
              </span>
              {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-[#507c76]" aria-label="Unread" />}
            </button>
          </form>
        </li>)}
      </ul>}
  </div>
}
