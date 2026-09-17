'use client'

import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { copyTripToPlan } from '@/actions/copyTrip'

export default function CopyTripButton({ itineraryId, title, isOwn }: { itineraryId: string; title: string; isOwn: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const [name, setName] = useState(`${title.slice(0, 145)} — next trip`)
  const [keepDays, setKeepDays] = useState(true)
  const [keepNotes, setKeepNotes] = useState(isOwn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const clientId = useRef<string | null>(null)
  const router = useRouter()

  return <>
    <button type="button" onClick={() => { setError(''); dialog.current?.showModal() }} className="min-h-11 rounded-full border border-[#8caaa3] bg-[#fffdf7] px-4 py-2 text-sm font-semibold text-[#507c76]">Copy trip</button>
    <dialog ref={dialog} aria-labelledby={headingId} onCancel={event => { if (saving.current) event.preventDefault() }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-[#d7cebc] bg-[#FAF7F2] p-5 text-[#2e4147] shadow-xl backdrop:bg-black/50">
      <h2 id={headingId} className="font-[family-name:var(--font-playfair)] text-2xl">Copy into a new plan</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#73786d]">Start a private plan with this trip’s places. Set new dates and change places for your next visit.</p>
      <form className="mt-5 space-y-4" onSubmit={async event => {
        event.preventDefault()
        if (saving.current) return
        saving.current = true; setBusy(true); setError('')
        clientId.current ??= crypto.randomUUID()
        try {
          const result = await copyTripToPlan({ sourceId: itineraryId, clientId: clientId.current, title: name, keepDays, keepNotes })
          if (result.error || !result.id) { setError(result.error || 'Could not copy this trip. Please try again.'); return }
          dialog.current?.close()
          clientId.current = null
          router.push(`/plan/${result.id}`)
          router.refresh()
        } catch { setError('Could not copy this trip. Your choices are still here; please try again.') }
        finally { saving.current = false; setBusy(false) }
      }}>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-semibold">New trip name<input autoFocus required maxLength={160} value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#8caaa3] bg-white p-3 text-base font-normal" /></label>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={keepDays} onChange={event => setKeepDays(event.target.checked)} className="h-5 w-5 accent-[#507c76]" />Keep the day-by-day layout</label>
          {isOwn && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={keepNotes} onChange={event => setKeepNotes(event.target.checked)} className="h-5 w-5 accent-[#507c76]" />Include my notes</label>}
          <p className="text-xs leading-relaxed text-[#73786d]">Places start as Considering with flexible dates. Photos and ratings stay with the original visit{isOwn ? '.' : ', along with the author’s notes.'}</p>
          <div className="flex flex-wrap gap-3"><button disabled={!name.trim()} className="min-h-11 rounded-full bg-[#507c76] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Copying…' : 'Create private copy'}</button><button type="button" onClick={() => dialog.current?.close()} className="min-h-11 px-3 text-sm">Cancel</button></div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
    </dialog>
  </>
}
