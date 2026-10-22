'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'

// The trip as a PDF, with private transport and booking details (only its owner can get it). In the iPhone app it
// opens the share sheet (save to Files, AirDrop, email); elsewhere it downloads.
export default function ItineraryPdf({ tripId, title }: { tripId: string; title: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function make() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/plan/${tripId}/pdf`, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const name = `${title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'itinerary'}.pdf`
      const file = new File([await response.blob()], name, { type: 'application/pdf' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file], title }).catch(() => {})
      } else {
        const url = URL.createObjectURL(file)
        const link = Object.assign(document.createElement('a'), { href: url, download: name })
        document.body.append(link); link.click(); link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch { setError('Couldn’t make the PDF. Please try again.') }
    finally { setBusy(false) }
  }
  return <span className="inline-flex flex-col">
    <button type="button" onClick={() => void make()} disabled={busy} className="btn btn-outline btn-sm"><FileDown size={16} />{busy ? 'Making PDF…' : 'Itinerary PDF'}</button>
    {error && <span role="alert" className="mt-1 text-xs text-danger">{error}</span>}
  </span>
}
