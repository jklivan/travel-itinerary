'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteItinerary } from '@/actions/itinerary'
import { keepTripPrivate } from '@/actions/keepTripPrivate'
import { LockKeyhole, Trash2 } from 'lucide-react'

// Just a trash can (its name is read out by screen readers); tapping it asks to confirm before anything is deleted.
// row: "Delete trip" as one of the plain buttons in the row at the end of a trip, asking in a pop-up (no room inline).
export default function DeleteButton({ id, visibility, returnTo = '/', label = 'Delete entire post', row = false }: { id: string; visibility: string; returnTo?: string; label?: string; compact?: boolean; row?: boolean }) {
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

  const question = <div className="space-y-3">
      {visibility !== 'draft' && <div className="panel-hint p-4">
        <p className="text-sm font-semibold text-ink">Unpublish this trip?</p>
        <p className="mt-1 text-sm text-muted">Keep all your places, notes, and photos as a private plan. Find it in Profile → In progress, and share it again whenever you’re ready.</p>
        <button type="button" onClick={() => void handleKeepPrivate()} disabled={pending} className="btn btn-primary mt-3"><LockKeyhole size={16} />{keeping ? 'Making private…' : 'Unpublish & keep privately'}</button>
      </div>}
      {confirming === 'delete' && <p className="max-w-full break-words text-sm text-muted">Delete this trip? This can’t be undone.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {confirming === 'delete' && <button type="button" onClick={() => void handleDelete()} disabled={pending} className="btn btn-danger">{pending && !keeping ? 'Deleting…' : 'Delete'}</button>}
        <button type="button" onClick={() => { setConfirming(null); setError('') }} disabled={pending} className="btn btn-outline text-muted">Cancel</button>
      </div>
      {row && error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  if (row) return <>
    <button type="button" onClick={() => setConfirming('delete')} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 px-2 text-xs text-danger sm:text-sm"><Trash2 size={16} />Delete trip</button>
    {confirming && <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 px-4 [grid-template-columns:minmax(0,1fr)]" role="dialog" aria-modal="true" aria-label="Delete this trip">
      <div className="panel w-full max-w-sm p-5 shadow-pop">{question}</div>
    </div>}
  </>
  return <div className="min-w-0 max-w-full flex-[0_0_auto]">
    {confirming ? question : <div className="flex flex-wrap items-center gap-2">
      {visibility !== 'draft' && <button type="button" onClick={() => setConfirming('unpublish')} className="chip"><LockKeyhole size={14} />Unpublish</button>}
      <button type="button" onClick={() => setConfirming('delete')} aria-label={label} title={label} className="btn-icon text-danger"><Trash2 size={16} /></button></div>}
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>
}
