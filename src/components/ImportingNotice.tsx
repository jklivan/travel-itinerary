'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// An emailed trip still being imported (Itinerary.importingSince): says so, and reloads the page every few seconds
// until the places are in, so nobody thinks the import failed while the trip shows no places yet. On the trip page
// (with the message) and My trips (just the reloading; its row says Importing your trip…).
export default function ImportingNotice({ message = true }: { message?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(timer)
  }, [router])
  if (!message) return null
  return <div className="mx-auto max-w-2xl px-4 pt-3">
    <p role="status" className="panel-hint flex items-center gap-2 p-3 text-sm text-ink"><Loader2 size={16} className="animate-spin" />Importing your trip from your email. The places will appear here in a minute.</p>
  </div>
}
