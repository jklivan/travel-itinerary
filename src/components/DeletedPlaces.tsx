'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Trash2 } from 'lucide-react'
import { deletedPlaces, restoreDeletedPlace } from '@/actions/planning'

type Deleted = Awaited<ReturnType<typeof deletedPlaces>>[number]

// A group trip's Deleted folder (#116): places someone deleted, and who and when, each with Restore.
export default function DeletedPlaces({ tripId, count }: { tripId: string; count: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Deleted[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  async function toggle() {
    setOpen(value => !value); setError('')
    if (!rows) setRows(await deletedPlaces(tripId).catch(() => []))
  }
  async function restore(id: string) {
    setBusy(id); setError('')
    try {
      const result = await restoreDeletedPlace(id)
      if (result.error) { setError(result.error); return }
      setRows(current => current?.filter(row => row.id !== id) ?? null)
      router.refresh()
    } catch { setError('Could not restore it. Please try again.') } finally { setBusy(null) }
  }
  const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return <div className="mt-6">
    <button type="button" onClick={() => void toggle()} aria-expanded={open} className="inline-flex items-center gap-1.5 text-sm text-link underline-offset-2 hover:underline"><Trash2 size={16} />Deleted places ({rows?.length ?? count})</button>
    {open && <section aria-label="Deleted places" className="panel-inset mt-2 space-y-2 p-3">
      <p className="text-xs text-muted">Places deleted from this trip. Anyone on it can bring one back.</p>
      {rows === null ? <p className="text-xs text-muted">Loading…</p> : !rows.length ? <p className="text-sm text-muted">Nothing deleted.</p>
        : rows.map(row => <div key={row.id} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1"><span className="font-semibold text-ink">{row.name}</span><span className="block text-xs text-muted">{row.by} deleted it · {when(row.deletedAt)}</span></span>
          <button type="button" disabled={busy === row.id} onClick={() => void restore(row.id)} className="chip"><RotateCcw size={14} />{busy === row.id ? 'Restoring…' : 'Restore'}</button>
        </div>)}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>}
  </div>
}
