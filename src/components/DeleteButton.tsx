'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteItinerary } from '@/actions/itinerary'
import { keepTripPrivate } from '@/actions/keepTripPrivate'
import { LockKeyhole, Trash2 } from 'lucide-react'

// Just a trash can (its name is read out by screen readers); tapping it asks to confirm before anything is deleted.
export default function DeleteButton({ id, visibility, returnTo = '/', label = 'Delete entire post' }: { id: string; visibility: string; returnTo?: string; label?: string; compact?: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<'delete' | 'unpublish' | null>(null)
  const [pending, setPending] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const [error, setError] = useState('')
  const deleting = useRef(false)

  async function handleDelete() {
    if (deleting.current) return
    deleting.current = true; setPending(true); setError('')
    try {
      const result = await deleteItinerary(id)
      if (result.error) setError(result.error)
      else { router.push(returnTo) }
    } catch { setError('Could not delete this post. Please try again.') }
    finally { deleting.current = false; setPending(false) }
  }

  async function handleKeepPrivate() {
    if (deleting.current) return
    deleting.current = true; setPending(true); setKeeping(true); setError('')
    try {
      const result = await keepTripPrivate(id)
      if (result.error) setError(result.error)
      else { router.push(`/plan/${id}`); setConfirming(null) }
    } catch { setError('Could not make this trip private. Your trip is still saved; please try again.') }
    finally { deleting.current = false; setPending(false); setKeeping(false) }
  }

  return <div className="min-w-0 max-w-full flex-[0_0_auto]">
    {confirming ? <div className="space-y-3">
      {visibility !== 'draft' && <div className="rounded-xl border border-mist-line bg-mist p-4">
        <p className="text-sm font-semibold text-ink">Unpublish this trip?</p>
        <p className="mt-1 text-sm text-muted">Keep all your places, notes, and photos as a private plan. Find it in Profile → In progress, and share it again whenever you’re ready.</p>
        <button type="button" onClick={() => void handleKeepPrivate()} disabled={pending} className="btn btn-primary mt-3"><LockKeyhole size={16} />{keeping ? 'Making private…' : 'Unpublish & keep privately'}</button>
      </div>}
      {confirming === 'delete' && <p className="max-w-full break-words text-sm text-muted">Delete this entire post and all its places, notes, and photos? This cannot be undone.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {confirming === 'delete' && <button type="button" onClick={() => void handleDelete()} disabled={pending} className="btn btn-danger">{pending && !keeping ? 'Deleting…' : 'Permanently delete entire post'}</button>}
        <button type="button" onClick={() => { setConfirming(null); setError('') }} disabled={pending} className="btn btn-outline text-muted">Cancel</button>
      </div>
    </div> : <div className="flex flex-wrap items-center gap-2">
      {visibility !== 'draft' && <button type="button" onClick={() => setConfirming('unpublish')} className="chip"><LockKeyhole size={14} />Unpublish</button>}
      <button type="button" onClick={() => setConfirming('delete')} aria-label={label} title={label} className="btn-icon text-danger"><Trash2 size={16} /></button></div>}
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>
}
