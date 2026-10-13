'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'
import { blockUser, unblockUser } from '@/actions/safety'

// On someone's profile: Block (asks first) / Unblock.
export default function BlockButton({ userId, name, initialBlocked }: { userId: string; name: string; initialBlocked: boolean }) {
  const router = useRouter()
  const [blocked, setBlocked] = useState(initialBlocked)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(next: boolean) {
    setBusy(true); setError('')
    try { const result = next ? await blockUser(userId) : await unblockUser(userId); if (result.error) setError(result.error); else { setBlocked(next); setConfirming(false); router.refresh() } }
    catch { setError('Could not update. Please try again.') } finally { setBusy(false) }
  }
  if (blocked) return <div className="inline-flex flex-wrap items-center gap-2">
    <button type="button" disabled={busy} onClick={() => void run(false)} className="chip">{busy ? 'Unblocking…' : 'Unblock'}</button>
    {error && <span role="alert" className="text-xs text-danger">{error}</span>}
  </div>
  if (confirming) return <div className="panel-inset space-y-2 p-3 text-sm">
    <p>Block {name}? You won’t see each other’s trips, comments or snapshots, you’ll stop following each other, and they can’t message you. They won’t be told.</p>
    <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void run(true)} className="btn btn-danger btn-sm">{busy ? 'Blocking…' : 'Block'}</button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="btn btn-outline btn-sm">Cancel</button></div>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
  </div>
  return <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"><Ban size={12} />Block</button>
}
