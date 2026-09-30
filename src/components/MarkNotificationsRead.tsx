'use client'

import { useState, useTransition } from 'react'
import { markAllNotificationsRead } from '@/actions/notifications'

export default function MarkNotificationsRead() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  return <div>
    <button disabled={pending} className="text-sm text-link hover:underline disabled:opacity-50" onClick={() => startTransition(async () => {
      setError(false)
      try {
        await markAllNotificationsRead()
        window.dispatchEvent(new Event('notifications-updated'))
      } catch { setError(true) }
    })}>{pending ? 'Updating…' : 'Mark all as read'}</button>
    {error && <p role="status" className="text-xs text-terracotta">Could not update. Please try again.</p>}
  </div>
}
