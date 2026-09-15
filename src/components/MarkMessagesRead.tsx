'use client'

import { useEffect } from 'react'
import { markMessagesRead } from '@/actions/messages'

export default function MarkMessagesRead({ senderId, messageIds }: { senderId: string; messageIds: string[] }) {
  const ids = JSON.stringify(messageIds)
  useEffect(() => {
    let active = true
    async function markRead() {
      if (document.visibilityState !== 'visible') return
      try {
        await markMessagesRead(senderId, JSON.parse(ids))
        if (active) window.dispatchEvent(new Event('notifications-updated'))
      } catch { /* Retry on focus or the next message refresh. */ }
    }
    void markRead()
    const timer = setInterval(markRead, 30000)
    window.addEventListener('focus', markRead)
    document.addEventListener('visibilitychange', markRead)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', markRead)
      document.removeEventListener('visibilitychange', markRead)
    }
  }, [senderId, ids])
  return null
}
