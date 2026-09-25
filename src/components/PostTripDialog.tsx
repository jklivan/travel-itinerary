'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { plansForPosting } from '@/actions/planning'
import styles from './Stories.module.css'

type Plan = { id: string; title: string; isPlan: boolean; places: number }

// The bottom bar's Post button: pick one of your private plans to post, or start a new trip from scratch.
// Same shape as the snapshot composer.
export default function PostTripDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState('new')
  const plan = plans?.find(p => p.id === choice)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    let active = true
    plansForPosting().then(result => {
      if (!active) return
      if (result.error) setError(result.error)
      setPlans(result.plans)
      setChoice(result.plans[0]?.id ?? 'new')
    }).catch(() => { if (active) { setError('Could not load your plans. You can still start a new trip.'); setPlans([]) } })
    return () => { active = false; element?.close() }
  }, [])

  function go() {
    dialog.current?.close()
    if (!plan) router.push('/create?start=scratch')
    // Plans open on their "A few more details" posting step. Plans link straight to /plan: the
    // trip editor's redirect there fails during in-app navigation.
    else if (!plan.isPlan) router.push(`/itinerary/${plan.id}/edit`)
    else router.push(plan.places ? `/plan/${plan.id}?post=1` : `/plan/${plan.id}`)
  }

  return <dialog ref={dialog} className={styles.composer} aria-labelledby={titleId} onClose={onClose}>
    <header className={styles.composerHeader}><div><h2 id={titleId}>Post a trip</h2><p>Share one of your private plans, or start a new one from scratch.</p></div><button type="button" className={styles.close} aria-label="Close" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
    <form onSubmit={event => { event.preventDefault(); go() }}>
      {!plans ? <p role="status" className={styles.empty}>Loading…</p> : <fieldset className={styles.fields}>
        <label>Which trip?<select value={choice} onChange={event => setChoice(event.target.value)}>
          {plans.map(p => <option key={p.id} value={p.id}>{p.title} · {p.places} {p.places === 1 ? 'place' : 'places'}</option>)}
          <option value="new">＋ New trip from scratch</option>
        </select></label>
        {plan && plan.places === 0 && <p className={styles.privacy}>This plan has no places yet. Add at least one before you post it.</p>}
        {!plans.length && !error && <p className={styles.privacy}>You don’t have any private plans yet, so you’ll start from scratch.</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button type="submit" className={styles.post}>{!plan ? 'Start from scratch →' : plan.places === 0 ? 'Open plan →' : 'Continue to post →'}</button>
      </fieldset>}
    </form>
  </dialog>
}
