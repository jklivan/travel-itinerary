'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CalendarClock } from 'lucide-react'
import { pendingDateChecks, resolveDateCheck } from '@/actions/dateChecks'
import { describeWhen } from '@/lib/dateCheck'

type Pending = Awaited<ReturnType<typeof pendingDateChecks>>[number]

// When you open the app: a booking emailed or imported for a place that's on another day or time in your trip
// (Jen booked Ajax Tavern for Monday; the trip had it on Wednesday). Asks which is right, one place at a time, and
// moves it if the booking is. Later hides it until the app is next opened. Checked like the "it arrived" notice.
export default function DateCheckPrompt() {
  const { status } = useSession()
  const router = useRouter()
  const [pending, setPending] = useState<Pending[]>([])
  const [later, setLater] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (status !== 'authenticated') return
    let live = true
    const check = () => { if (document.visibilityState === 'visible') void pendingDateChecks().then(rows => { if (live) { setPending(rows); setLater(false) } }, () => {}) }
    check()
    document.addEventListener('visibilitychange', check)
    return () => { live = false; document.removeEventListener('visibilitychange', check) }
  }, [status])
  const place = pending[0]
  if (!place || later) return null
  const booking = describeWhen(place.check, place.start)
  const trip = describeWhen(place.current, place.start)
  // Button labels: the day alone when the day differs, otherwise the time.
  const sameDay = describeWhen(place.check, place.start, false) === describeWhen(place.current, place.start, false)
  const bookingShort = sameDay ? describeWhen({ ...place.check, date: null, day: null }, null) : describeWhen(place.check, place.start, false)
  const tripShort = sameDay ? describeWhen({ ...place.current, date: null, day: null }, null) : describeWhen(place.current, place.start, false)
  async function answer(move: boolean) {
    setBusy(true); setError('')
    const result = await resolveDateCheck(place.id, move).catch(() => ({ error: 'Couldn’t save that. Please try again.' }))
    setBusy(false)
    if (result.error) { setError(result.error); return }
    setPending(current => current.slice(1))
    router.refresh()
  }
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/50 px-4 [grid-template-columns:minmax(0,1fr)]" role="dialog" aria-modal="true" aria-labelledby="date-check-heading">
    <div className="panel w-full max-w-sm space-y-3 p-5 shadow-pop">
      <h2 id="date-check-heading" className="type-title flex items-center gap-2"><CalendarClock size={22} className="shrink-0 text-link" />Which is right?</h2>
      <p className="text-sm text-ink">Your <strong>{place.name}</strong> booking says <strong>{booking || 'another time'}</strong>, but <Link href={`/plan/${place.tripId}`} onClick={() => setLater(true)} className="text-link underline">{place.tripTitle}</Link> has it {trip ? <>on <strong>{trip}</strong></> : 'on another day'}.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-2">
        <button type="button" disabled={busy} onClick={() => void answer(true)} className="btn btn-primary">Move to {bookingShort || 'the booking’s time'}</button>
        <button type="button" disabled={busy} onClick={() => void answer(false)} className="btn btn-outline">Keep {tripShort || 'it where it is'}</button>
        <button type="button" disabled={busy} onClick={() => setLater(true)} className="min-h-11 text-sm text-link">Later</button>
      </div>
    </div>
  </div>
}
