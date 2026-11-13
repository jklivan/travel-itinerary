'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { switchMemory } from '@/actions/travelerMemory'

// Settings → What Postcard knows about you: whether the AI planner remembers things about them. Turning it off also
// clears what it had.
export default function MemorySwitch({ on }: { on: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return <button type="button" aria-pressed={on} disabled={busy} onClick={async () => {
    setBusy(true)
    try { const result = await switchMemory(!on); if (!result.error) router.refresh() } finally { setBusy(false) }
  }} className="chip shrink-0">{busy ? 'Saving…' : on ? 'On' : 'Off'}</button>
}
