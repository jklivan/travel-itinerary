'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// Keeps messages, replies and alerts up to date: every 15 seconds and whenever the app comes back into view.
export default function MessageRefresh() {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh() }
    const timer = setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    window.addEventListener('notifications-updated', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('notifications-updated', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router])
  return null
}
