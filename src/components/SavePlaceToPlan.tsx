'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { copyPlaceToPlan, plansForSaving } from '@/actions/planning'

export default function SavePlaceToPlan({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false)
  const [trips, setTrips] = useState<{ id: string; title: string }[]>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const attempt = useRef({ plan: '', id: '' })
  return <section className="rounded-xl border border-[#d7cebc] p-3">
    {!open ? <button disabled={busy} className="min-h-11 text-sm font-semibold text-[#507c76]" onClick={async () => {
      setBusy(true); setError('')
      try { const result = await plansForSaving(); if (result.error) setError(result.error); else { setTrips(result.trips); setSelected(result.trips[0]?.id ?? ''); setOpen(true) } }
      catch { setError('Could not load your plans. Please try again.') } finally { setBusy(false) }
    }}>{busy ? 'Loading plans…' : 'Save to a trip'}</button> : <>
      {trips.length ? <><label className="block text-sm">Choose your plan<select value={selected} onChange={e => { setSelected(e.target.value); setSaved(''); setError('') }} disabled={busy} className="mt-2 w-full rounded-lg border border-[#d7cebc] bg-white p-3">{trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><button disabled={busy || saved === selected} className="mt-3 min-h-11 rounded-lg bg-[#507c76] px-4 text-sm text-white disabled:opacity-50" onClick={async () => {
        setBusy(true); setError('')
        if (attempt.current.plan !== selected) attempt.current = { plan: selected, id: crypto.randomUUID() }
        try { const result = await copyPlaceToPlan(itemId, selected, attempt.current.id); if (result.error) setError(result.error); else setSaved(selected) }
        catch { setError('Could not save. Please try again.') } finally { setBusy(false) }
      }}>{busy ? 'Saving…' : saved === selected ? 'Saved' : 'Save place'}</button>{saved && <Link href={`/plan/${saved}`} className="ml-3 text-sm text-[#507c76] underline">Open plan →</Link>}</> : <p className="text-sm">Start a plan first, then come back to save this place.</p>}
      <Link href="/plan" className="mt-3 block text-sm text-[#507c76] underline">Start a new plan</Link>
    </>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>
}
