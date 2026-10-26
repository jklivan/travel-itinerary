'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { moveEmailPlaces, undoEmailPlaces } from '@/actions/inboxFix'

// Move the places an email added into another plan, into a trip of their own, or remove them.
export default function FixEmailedPlaces({ ref_, current, places, plans }: { ref_: string; current: { id: string; title: string }; places: string[]; plans: { id: string; title: string }[] }) {
  const router = useRouter()
  const [target, setTarget] = useState(plans[0]?.id ?? 'new')
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function move(to: string) {
    setBusy(true); setMessage('')
    try { const result = await moveEmailPlaces(ref_, to); if (result.planId) router.push(`/plan/${result.planId}`); else setMessage(result.error ?? 'Please try again.') }
    catch { setMessage('Couldn’t move them. Please try again.') } finally { setBusy(false) }
  }
  async function undo() {
    setBusy(true); setMessage('')
    try { const result = await undoEmailPlaces(ref_); if (result.error) setMessage(result.error); else router.push('/trips') }
    catch { setMessage('Couldn’t remove them. Please try again.') } finally { setBusy(false) }
  }
  return <div className="space-y-4">
    <section className="panel space-y-2 p-4">
      <p className="text-sm text-ink">Added {places.length} {places.length === 1 ? 'place' : 'places'} to <Link href={`/plan/${current.id}`} className="font-semibold text-link underline">{current.title}</Link>:</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink">{places.map((name, index) => <li key={index}>{name}</li>)}</ul>
    </section>
    <section className="panel space-y-3 p-4" aria-labelledby="move-heading">
      <h2 id="move-heading" className="type-label text-ink">Wrong trip?</h2>
      {plans.length > 0 && <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm text-ink">Move them to<select id="move-target" value={target} onChange={event => setTarget(event.target.value)} className="field mt-1 w-full">{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title || 'Untitled trip'}</option>)}</select></label>
        <button type="button" disabled={busy} onClick={() => void move(target)} className="btn btn-primary btn-sm">Move</button>
      </div>}
      <button type="button" disabled={busy} onClick={() => void move('new')} className="btn btn-outline btn-sm">Make them their own trip</button>
    </section>
    <section className="panel space-y-2 p-4">
      {!confirmUndo ? <button type="button" disabled={busy} onClick={() => setConfirmUndo(true)} className="btn btn-outline btn-sm">Undo: remove these places</button>
        : <div className="space-y-2"><p className="text-sm text-ink">Remove the {places.length} {places.length === 1 ? 'place' : 'places'} this email added? Places that were already in the trip stay.</p>
          <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void undo()} className="btn btn-danger btn-sm">Remove them</button><button type="button" onClick={() => setConfirmUndo(false)} className="btn btn-outline btn-sm">Keep them</button></div></div>}
    </section>
    {message && <p role="alert" className="text-sm text-danger">{message}</p>}
  </div>
}
