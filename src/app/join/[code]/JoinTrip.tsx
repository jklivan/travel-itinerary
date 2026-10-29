'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { answerInvite } from '@/actions/tripMembers'

export default function JoinTrip({ code }: { code: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'join' | 'no' | null>(null)
  const [error, setError] = useState('')
  async function answer(join: boolean) {
    setBusy(join ? 'join' : 'no'); setError('')
    try {
      const result = await answerInvite(code, join)
      if (result.error) { setError(result.error); return }
      router.push(join && result.tripId ? `/plan/${result.tripId}` : '/plan')
    } catch { setError('Something went wrong. Please try again.') }
    finally { setBusy(null) }
  }
  return <div className="mt-5">
    <div className="flex justify-center gap-2">
      <button type="button" disabled={!!busy} onClick={() => void answer(true)} className="btn btn-primary">{busy === 'join' ? 'Joining…' : 'Join trip'}</button>
      <button type="button" disabled={!!busy} onClick={() => void answer(false)} className="btn btn-outline">No thanks</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </div>
}
