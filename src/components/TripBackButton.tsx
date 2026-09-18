'use client'

import { useRouter } from 'next/navigation'
import { previousPage } from '@/lib/backNavigation'
import { tripReturnPath } from '@/lib/tripNavigation'

export default function TripBackButton({ itineraryId, fallback, className = 'mb-6 min-h-11' }: { itineraryId: string; fallback: string; className?: string }) {
  const router = useRouter()
  return <button type="button" onClick={() => { if (previousPage(window.history.state)) router.back(); else router.push(tripReturnPath(itineraryId, fallback)) }} className={`text-sm text-[#8B6F4E] hover:underline inline-block ${className}`}>← Back</button>
}
