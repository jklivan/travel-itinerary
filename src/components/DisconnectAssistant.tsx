'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { disconnectAssistant } from '@/actions/oauth'

// Settings → Connected assistants: stop an assistant using your Postcard account.
export default function DisconnectAssistant({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return <button type="button" disabled={busy} aria-label={`Disconnect ${name}`} onClick={async () => {
    setBusy(true)
    try { await disconnectAssistant(clientId); router.refresh() } finally { setBusy(false) }
  }} className="btn btn-outline btn-sm">{busy ? 'Disconnecting…' : 'Disconnect'}</button>
}
