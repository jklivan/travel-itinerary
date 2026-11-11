'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { tripShareLink } from '@/actions/tripShare'

// The paper airplane on a trip: opens the phone's share sheet (Messages, WhatsApp…) with the trip's link; a private trip
// sends a view-only link. Where there's no share sheet, the link is copied instead.
export default function SendTripButton({ tripId, title }: { tripId: string; title: string }) {
  const [note, setNote] = useState('')
  async function send() {
    setNote('')
    const result = await tripShareLink(tripId).catch(() => ({ error: 'Could not make a link. Please try again.' } as { error: string; path?: string }))
    if (!result.path) { setNote(result.error ?? 'Could not make a link.'); return }
    const url = `${window.location.origin}${result.path}`
    const text = `${title || 'A trip'} on Postcard`
    if (navigator.share) { await navigator.share({ title: text, text, url }).catch(() => {}); return }
    try { await navigator.clipboard.writeText(url); setNote('Link copied') } catch { setNote(url) }
  }
  return <span className="relative inline-flex">
    <button type="button" onClick={() => void send()} aria-label="Send this trip" title="Send this trip" className="btn-icon"><Send size={18} /></button>
    {note && <span role="status" className="absolute right-0 top-full z-10 mt-1 w-max max-w-64 rounded-lg bg-ink px-2 py-1 text-xs text-white [overflow-wrap:anywhere]">{note}</span>}
  </span>
}
