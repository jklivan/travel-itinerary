'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronRight, MapPin, Plus, X } from 'lucide-react'
import { copyPlaceToPlan, plansForSaving } from '@/actions/planning'
import styles from './SavePlaceToPlan.module.css'

type Trip = { id: string; title: string }
export default function SavePlaceToPlan({ itemId, placeName, open, onClose, onSaved }: {
  itemId: string; placeName: string; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const saving = useRef(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Trip | null>(null)
  const attempts = useRef(new Map<string, string>())
  const [added, setAdded] = useState(new Set<string>())

  async function load() {
    setLoading(true); setError('')
    try { const result = await plansForSaving(); setTrips(result.trips); if (result.error) setError(result.error) }
    catch { setError('Could not load your trips. Please try again.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (!open) return
    const element = dialog.current
    element?.showModal()
    const overflow = document.body.style.overflow
    if (overflow !== 'hidden') document.body.style.overflow = 'hidden'
    let active = true
    void Promise.resolve().then(() => { if (active) { setSaved(null); void load() } })
    return () => {
      active = false
      element?.close()
      if (overflow !== 'hidden') document.body.style.overflow = overflow
    }
  }, [open])

  async function save(trip: Trip) {
    if (saving.current) return
    if (added.has(trip.id)) { setSaved(trip); return }
    saving.current = true; setBusy(trip.id); setError('')
    if (!attempts.current.has(trip.id)) attempts.current.set(trip.id, crypto.randomUUID())
    try {
      const result = await copyPlaceToPlan(itemId, trip.id, attempts.current.get(trip.id)!)
      if (result.error) setError(result.error)
      else { setAdded(previous => new Set([...previous, trip.id])); setSaved(trip); onSaved() }
    } catch { setError('Could not save this place. Please try again.') }
    finally { saving.current = false; setBusy('') }
  }

  return <dialog ref={dialog} className={styles.sheet} aria-labelledby={titleId} onClose={onClose} onCancel={event => { if (saving.current) event.preventDefault() }} onClick={event => {
    if (event.target !== event.currentTarget || saving.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close()
  }}>
    <div className={styles.handle} aria-hidden="true" />
    <header className={styles.header}><div><h2 id={titleId}>Save to a trip</h2><p>{placeName}</p></div><button type="button" autoFocus disabled={!!busy} className={styles.close} aria-label="Close save to a trip" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
    <div className={styles.body}>
      {saved ? <div className={styles.success} role="status"><span className={styles.successIcon}><Check size={26} /></span><h3>Added to {saved.title}</h3><p>Your place is ready in your plan.</p><Link href={`/plan/${saved.id}`} onClick={() => dialog.current?.close()} className={styles.openPlan}>Open trip <ChevronRight size={16} /></Link><button type="button" className={styles.done} onClick={() => dialog.current?.close()}>Done</button></div> : <>
        {loading ? <p role="status" className={styles.empty}>Loading your trips…</p> : trips.length ? <div className={styles.trips}>{trips.map(trip => <button key={trip.id} type="button" disabled={!!busy} onClick={() => void save(trip)} className={styles.trip}>
          <span className={styles.tripIcon}><MapPin size={20} /></span><span className={styles.tripTitle}>{trip.title}<small>{busy === trip.id ? 'Adding…' : added.has(trip.id) ? 'Already added' : 'Add this place'}</small></span>{added.has(trip.id) ? <Check size={19} /> : <Plus size={19} />}
        </button>)}</div> : !error && <p className={styles.empty}>Start your first plan to keep the places you want to visit together.</p>}
        {error && <div className={styles.error}><p role="alert">{error}</p>{!trips.length && <button type="button" onClick={() => void load()}>Try again</button>}{error.toLowerCase().includes('sign in') && <Link href="/login" onClick={() => dialog.current?.close()}>Sign in</Link>}</div>}
      </>}
    </div>
    {!saved && !busy && <footer className={styles.footer}><Link href={`/plan?savePlace=${encodeURIComponent(itemId)}`} onClick={() => dialog.current?.close()}><span className={styles.newIcon}><Plus size={20} /></span>Start a new plan</Link></footer>}
  </dialog>
}
