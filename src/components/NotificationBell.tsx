'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { notificationStatus } from '@/actions/notifications'

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()
  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (document.hidden) return
      try { const status = await notificationStatus(); if (active) setCount(status.unread) } catch { /* Keep the last known count when offline. */ }
    }
    void refresh()
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('notifications-updated', refresh)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('notifications-updated', refresh) }
  }, [pathname])
  return <Link href="/notifications" aria-label={`Notifications${count ? `, ${count} unread` : ''}`} className="relative rounded-full p-2 hover:bg-white/10">
    <Bell size={20} />
    {count > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-[#507c76] px-1 text-center text-[10px] text-white">{count > 99 ? '99+' : count}</span>}
  </Link>
}
