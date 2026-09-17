'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function MessageRefresh({ label = 'Refresh messages' }: { label?: string }) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh() }
    const timer = setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [router])
  return <button type="button" onClick={() => router.refresh()} className="text-sm underline text-[#507c76]">{label}</button>
}
