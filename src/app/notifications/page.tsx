import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import MarkNotificationsRead from '@/components/MarkNotificationsRead'
import NotificationList from '@/components/NotificationList'
import { NotificationPreferences } from '@/components/NativeNotifications'
import MessageRefresh from '@/components/MessageRefresh'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 className="type-display">Notifications</h1>
      <MarkNotificationsRead />
    </div>
    <NotificationPreferences />
    <MessageRefresh />
    <NotificationList userId={session.user.id} empty="Forum posts, private messages, new followers, new trips from people you follow, and activity on your trips appear here." />
  </div>
}
