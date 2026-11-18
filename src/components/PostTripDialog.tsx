'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { plansForPosting } from '@/actions/planning'

type Plan = { id: string; title: string; isPlan: boolean; places: number }
const count = (places: number) => `${places} ${places === 1 ? 'place' : 'places'}`

// The bottom bar's Post button: a short sheet that slides up over the page. Pick one of your trips that isn't posted
// yet (tap the box to choose another) and Continue, or start a new one from scratch. (It used to be a tall, mostly
// empty page with a dropdown.)
export default function PostTripDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const plan = plans?.find(p => p.id === choice)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let active = true
    plansForPosting().then(result => {
      if (!active) return
      if (result.error) setError(result.error)
      setPlans(result.plans)
      setChoice(result.plans[0]?.id ?? null)
    }).catch(() => { if (active) { setError('Could not load your trips. You can still start a new one.'); setPlans([]) } })
    return () => { active = false; document.body.style.overflow = previous; element?.close() }
  }, [])

  function go(to: Plan | null) {
    dialog.current?.close()
    if (!to) router.push('/plan?from=post')
    // Trips open in the planner on their "A few more details" posting step.
    else router.push(to.places ? `/plan/${to.id}?post=1` : `/plan/${to.id}`)
  }

  return <dialog ref={dialog} aria-labelledby={titleId} onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current?.close() }}
    className="bottom-sheet m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-card p-0 text-ink shadow-pop backdrop:bg-ink/50 sm:mx-auto sm:max-w-md">
    <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
      <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line" />
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="type-title">Post a trip</h2>
        <button type="button" aria-label="Close" onClick={() => dialog.current?.close()} className="btn-icon"><X size={18} /></button>
      </header>
      {!plans ? <p role="status" className="py-6 text-center text-sm text-muted">Loading…</p> : <>
        {plan && <>
          <p className="field-label mb-2">Not yet posted</p>
          {/* The trip to post: tap to choose another of your trips that isn't posted yet. */}
          <button type="button" aria-expanded={picking} aria-controls="post-trip-choices" onClick={() => setPicking(open => !open)} disabled={plans.length < 2}
            className="field flex w-full items-center gap-3 text-left">
            <span className="min-w-0 flex-1"><span className="block truncate text-base text-ink">{plan.title}</span><span className="block text-sm text-muted">{count(plan.places)}</span></span>
            {plans.length > 1 && <ChevronDown size={18} className={`shrink-0 text-link transition-transform ${picking ? 'rotate-180' : ''}`} />}
          </button>
          {picking && <ul id="post-trip-choices" className="panel-inset mt-2 max-h-56 overflow-y-auto p-1">
            {plans.map(p => <li key={p.id}><button type="button" onClick={() => { setChoice(p.id); setPicking(false) }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-cream">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm text-ink">{p.title}</span><span className="block text-xs text-muted">{count(p.places)}</span></span>
              {p.id === plan.id && <Check size={16} className="shrink-0 text-link" />}
            </button></li>)}
          </ul>}
          {plan.places === 0 && <p className="mt-2 text-sm text-muted">This trip has no places yet. Add at least one before you post it.</p>}
          <button type="button" onClick={() => go(plan)} className="btn btn-primary mt-4 w-full">{plan.places === 0 ? 'Open trip' : 'Continue'}</button>
          <div aria-hidden="true" className="my-4 flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
        </>}
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <button type="button" onClick={() => go(null)} className="btn btn-outline w-full"><Plus size={18} />Start from scratch</button>
      </>}
    </div>
  </dialog>
}
