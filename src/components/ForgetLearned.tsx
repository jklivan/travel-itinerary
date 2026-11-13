'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { forgetLearned } from '@/actions/travelerMemory'

// Settings → What Postcard knows about you: the planner forgets this one.
export default function ForgetLearned({ item }: { item: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return <button type="button" disabled={busy} aria-label={`Forget “${item}”`} title="Forget this" onClick={async () => {
    setBusy(true)
    try { const result = await forgetLearned(item); if (!result.error) router.refresh() } finally { setBusy(false) }
  }} className="btn-icon shrink-0 text-muted"><X size={16} /></button>
}
