'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { notificationStatus } from '@/actions/notifications'

export default function useNotificationCounts() {
  const [counts, setCounts] = useState({ unread: 0, unreadMessages: 0 })
  const pathname = usePathname()
  useEffect(() => {
    let active = true
    let revision = 0
    const refresh = async () => {
      if (document.hidden) return
      const current = ++revision
      try {
        const status = await notificationStatus()
        if (active && current === revision) setCounts({ unread: status.unread, unreadMessages: status.unreadMessages })
      } catch { /* Keep the last known count when offline. */ }
    }
    void refresh()
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('notifications-updated', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('notifications-updated', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [pathname])
  return counts
}
