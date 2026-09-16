'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteItinerary } from '@/actions/itinerary'
import { Trash2 } from 'lucide-react'

export default function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const deleting = useRef(false)

  async function handleDelete() {
    if (deleting.current) return
    deleting.current = true; setPending(true); setError('')
    try {
      const result = await deleteItinerary(id)
      if (result.error) setError(result.error)
      else { router.push('/'); router.refresh() }
    } catch { setError('Could not delete this post. Please try again.') }
    finally { deleting.current = false; setPending(false) }
  }

  return <div>
    {confirming ? <div className="space-y-3">
      <p className="text-sm text-[#73786d]">Delete this entire post and all its places, notes, and photos? This cannot be undone.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void handleDelete()} disabled={pending} className="min-h-11 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{pending ? 'Deleting…' : 'Yes, delete entire post'}</button>
        <button type="button" onClick={() => { setConfirming(false); setError('') }} disabled={pending} className="min-h-11 rounded-full border border-[#d7cebc] px-4 py-2 text-sm text-[#73786d]">Keep post</button>
      </div>
    </div> : <button type="button" onClick={() => setConfirming(true)} className="flex min-h-11 items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 size={16} />Delete entire post</button>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}
