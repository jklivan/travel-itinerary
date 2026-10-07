'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sharePlan } from '@/actions/planning'

type Format = 'guide' | 'day-trip' | 'itinerary'

// Shown on the trip page in preview mode (a private plan, after "A few more details" → Continue):
// the trip as it will look once posted, with a last chance to make changes.
export default function PublishPreviewBar({ id, postType, budget, tripRating, tags }: { id: string; postType: string; budget: number | null; tripRating: number | null; tags: string[] }) {
  const router = useRouter()
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const format: Format = postType === 'guide' ? 'guide' : postType === 'day-trip' ? 'day-trip' : 'itinerary'

  async function post() {
    if (posting) return
    setPosting(true); setError('')
    try {
      const result = await sharePlan(id, format, { budget: budget ?? 0, tripRating: tripRating ?? 0, tags: tags.filter(tag => tag !== 'day-trip') })
      if (result.error) setError(result.error)
      else router.push(`/?posted=${encodeURIComponent(id)}`)
    } catch { setError('Could not post your trip. Please try again.') }
    finally { setPosting(false) }
  }

  return <div className="pointer-events-none fixed bottom-[var(--app-bottom-clearance)] left-0 right-0 z-40 px-4 pb-2">
    <div className="panel pointer-events-auto mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 p-3 shadow-lg backdrop-blur">
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-ink">Ready to post?</p>
        <p className="text-xs text-muted">This is how your trip will look. <Link href={`/plan/${id}?post=1`} className="underline">Change type, budget or tags</Link></p>
        {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={`/plan/${id}`} className="btn btn-outline">Make changes</Link>
        <button type="button" disabled={posting} onClick={() => void post()} className="btn btn-primary">{posting ? 'Posting…' : 'Post trip'}</button>
      </div>
    </div>
  </div>
}
