'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import useNotificationCounts from './useNotificationCounts'

// The profile icon. A red dot means there are unread alerts; they're listed on the Profile page.
export default function HeaderProfileLink() {
  const { unreadAlerts } = useNotificationCounts()
  return <Link href="/profile" aria-label={`Profile${unreadAlerts ? `, ${unreadAlerts} new ${unreadAlerts === 1 ? 'alert' : 'alerts'}` : ''}`}
    className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-ink/10 transition-colors sm:size-11">
    <User size={22} />
    {unreadAlerts > 0 && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-danger ring-2 ring-paper" />}
  </Link>
}
