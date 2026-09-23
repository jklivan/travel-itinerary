'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteItinerary } from '@/actions/itinerary'
import { keepTripPrivate } from '@/actions/keepTripPrivate'
import { LockKeyhole, Trash2 } from 'lucide-react'

export default function DeleteButton({ id, visibility, returnTo = '/', label = 'Delete entire post', compact = false }: { id: string; visibility: string; returnTo?: string; label?: string; compact?: boolean }) {
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
      {visibility !== 'draft' && <div className="rounded-xl border border-[#c4d3c8] bg-[#edf1e9] p-4">
        <p className="text-sm font-semibold text-[#2e4147]">Unpublish this trip?</p>
        <p className="mt-1 text-sm text-[#73786d]">Keep all your places, notes, and photos as a private plan. Find it in Profile → In progress, and share it again whenever you’re ready.</p>
        <button type="button" onClick={() => void handleKeepPrivate()} disabled={pending} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#59694f] px-4 py-2 text-sm font-medium text-white hover:bg-[#355650] disabled:opacity-50"><LockKeyhole size={16} />{keeping ? 'Making private…' : 'Unpublish & keep privately'}</button>
      </div>}
      {confirming === 'delete' && <p className="max-w-full break-words text-sm text-[#73786d]">Delete this entire post and all its places, notes, and photos? This cannot be undone.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {confirming === 'delete' && <button type="button" onClick={() => void handleDelete()} disabled={pending} className="min-h-11 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{pending && !keeping ? 'Deleting…' : 'Permanently delete entire post'}</button>}
        <button type="button" onClick={() => { setConfirming(null); setError('') }} disabled={pending} className="min-h-11 rounded-full border border-[#d7cebc] px-4 py-2 text-sm text-[#73786d]">Cancel</button>
      </div>
    </div> : <div className="flex flex-wrap items-center gap-2">
      {visibility !== 'draft' && <button type="button" onClick={() => setConfirming('unpublish')} className="flex min-h-11 items-center gap-2 rounded-full border border-[#8caaa3] bg-[#edf1e9] px-4 py-2 text-sm font-medium text-[#365e58] hover:bg-[#dde8de]"><LockKeyhole size={16} />Unpublish</button>}
      <button type="button" onClick={() => setConfirming('delete')} aria-label={label} title={label} className={compact ? 'flex h-11 w-14 items-center justify-center rounded-full border border-red-200 text-red-700 hover:bg-red-50' : 'flex min-h-11 items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50'}><Trash2 size={compact ? 18 : 16} />{!compact && label}</button></div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}
