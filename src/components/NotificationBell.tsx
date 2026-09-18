'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import useNotificationCounts from './useNotificationCounts'

export default function NotificationBell() {
  const { unread: count } = useNotificationCounts()
  return <Link href="/notifications" aria-label={`Notifications${count ? `, ${count} unread` : ''}`} className="relative rounded-full p-2 hover:bg-white/10">
    <Bell size={20} />
    {count > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-[#59694f] px-1 text-center text-[10px] text-white">{count > 99 ? '99+' : count}</span>}
  </Link>
}
