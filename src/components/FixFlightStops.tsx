'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fixFlightStops } from '@/actions/adminFlightStops'

// Admin → Flights-only stops: fold them all into their trips' real stops.
export default function FixFlightStops({ count }: { count: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setMessage('')
      try { const result = await fixFlightStops(); setMessage('error' in result ? result.error ?? '' : `Fixed ${result.fixed}.`); router.refresh() }
      catch { setMessage('Something went wrong. Nothing after the error was changed; try again.') }
      finally { setBusy(false) }
    }} className="btn btn-primary">{busy ? 'Fixing…' : `Fix all ${count}`}</button>
    {message && <p role="status" className="text-sm text-link">{message}</p>}
  </div>
}
