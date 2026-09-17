'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronRight, MapPin, Plus, X } from 'lucide-react'
import { copyPlaceToPlan, plansForSaving } from '@/actions/planning'
import { copyStoryToPlan } from '@/actions/stories'
import { savePlaceToNewPlan } from '@/actions/quickSavePlan'
import styles from './SavePlaceToPlan.module.css'

type Trip = { id: string; title: string }
export default function SavePlaceToPlan({ itemId, storyId, placeName, open, onClose, onSaved }: {
  itemId?: string; storyId?: string; placeName: string; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const saving = useRef(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Trip | null>(null)
  const [createdId, setCreatedId] = useState('')
  const newPlanAttempt = useRef<string | null>(null)
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
      const result = storyId ? await copyStoryToPlan(storyId, trip.id, attempts.current.get(trip.id)!) : await copyPlaceToPlan(itemId!, trip.id, attempts.current.get(trip.id)!)
      if (result.error) setError(result.error)
      else { setAdded(previous => new Set([...previous, trip.id])); setSaved(trip); onSaved() }
    } catch { setError('Could not save this place. Please try again.') }
    finally { saving.current = false; setBusy('') }
  }

  async function saveNew() {
    if (saving.current) return
    saving.current = true; setBusy('new-plan'); setError('')
    newPlanAttempt.current ??= crypto.randomUUID()
    try {
      const result = await savePlaceToNewPlan({ itemId, storyId, clientId: newPlanAttempt.current })
      if (result.error || !result.trip) { setError(result.error || 'Could not save this place. Please try again.'); return }
      const trip = result.trip
      newPlanAttempt.current = null
      setTrips(previous => [trip, ...previous.filter(existing => existing.id !== trip.id)])
      setAdded(previous => new Set([...previous, trip.id])); setSaved(trip); setCreatedId(trip.id); onSaved()
    } catch { setError('Could not save this place. Please try again.') }
    finally { saving.current = false; setBusy('') }
  }

  return <dialog ref={dialog} className={styles.sheet} aria-labelledby={titleId} onClose={onClose} onCancel={event => { if (saving.current) event.preventDefault() }} onClick={event => {
    if (event.target !== event.currentTarget || saving.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close()
  }}>
    <div className={styles.handle} aria-hidden="true" />
    <header className={styles.header}><div><h2 id={titleId}>{saved ? 'Place saved' : 'Which trip?'}</h2><p>{placeName}</p></div><button type="button" autoFocus disabled={!!busy} className={styles.close} aria-label="Close save to a trip" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
    <div className={styles.body}>
      {saved ? <div className={styles.success} role="status"><span className={styles.successIcon}><Check size={26} /></span><h3>Added to {saved.title}</h3><p>{saved.id === createdId ? 'Saved to a private trip with a temporary title. Rename it and add dates whenever you’re ready.' : 'Your place is ready in your plan.'}</p><button type="button" className={styles.openPlan} onClick={() => dialog.current?.close()}>Keep browsing</button><Link href={`/plan/${saved.id}${saved.id === createdId ? '?details=1' : ''}`} onClick={() => dialog.current?.close()} className={styles.done}>{saved.id === createdId ? 'Finish new trip' : 'Open trip'} <ChevronRight size={16} className="inline" /></Link></div> : <>
        {loading ? <p role="status" className={styles.empty}>Loading your trips…</p> : trips.length ? <div className={styles.trips}>{trips.map(trip => <button key={trip.id} type="button" disabled={!!busy} onClick={() => void save(trip)} className={styles.trip}>
          <span className={styles.tripIcon}><MapPin size={20} /></span><span className={styles.tripTitle}>{trip.title}<small>{busy === trip.id ? 'Adding…' : added.has(trip.id) ? 'Already added' : 'Add this place'}</small></span>{added.has(trip.id) ? <Check size={19} /> : <Plus size={19} />}
        </button>)}</div> : !error && <p className={styles.empty}>Start your first plan to keep the places you want to visit together.</p>}
        {error && <div className={styles.error}><p role="alert">{error}</p>{!trips.length && <button type="button" onClick={() => void load()}>Try again</button>}{error.toLowerCase().includes('sign in') && <Link href="/login" onClick={() => dialog.current?.close()}>Sign in</Link>}</div>}
      </>}
    </div>
    {!saved && <footer className={styles.footer}><button type="button" disabled={!!busy || loading} className="flex min-h-12 w-full items-center gap-3 text-left text-sm font-semibold text-[#507c76]" onClick={() => void saveNew()}><span className={styles.newIcon}><Plus size={20} /></span><span>{busy === 'new-plan' ? 'Saving to a new trip…' : 'New trip'}<small className="mt-1 block font-normal text-[#73786d]">Save now with a temporary title. Finish later.</small></span></button></footer>}
  </dialog>
}
