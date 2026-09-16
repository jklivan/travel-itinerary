'use client'

import { useRef, useState } from 'react'
import { backfillPlaceIds } from '@/actions/backfillPlaceIds'

type Row = Awaited<ReturnType<typeof backfillPlaceIds>>['rows'][number]
export default function PlaceIdBackfill() {
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('')
  const stopped = useRef(false)
  const active = useRef(false)
  async function run(apply: boolean) {
    if (active.current) return
    active.current = true; stopped.current = false; setRunning(true); setRows([]); setError(''); setMode(apply ? 'Saving' : 'Previewing')
    let after = ''
    try {
      do {
        const result = await backfillPlaceIds({ after, apply })
        if (result.error) throw Error(result.error)
        setRows(previous => [...previous, ...result.rows])
        if (result.rows.some(row => row.status === 'error')) { setError('Stopped after a lookup error. You can retry; existing IDs will be preserved.'); break }
        if (!result.next) break
        after = result.next
      } while (!stopped.current)
    } catch { setError('Could not finish this batch. Sign in as an administrator and try again.') }
    finally { active.current = false; setRunning(false) }
  }
  return <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
    <h2 className="text-lg font-semibold">Connect older places to Google</h2>
    <p className="mt-2 text-sm text-gray-600">Find missing place IDs using the saved name and destination. Existing IDs, ratings, notes, and photos stay unchanged. Ambiguous matches are skipped.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={running} onClick={() => void run(false)} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">Preview matches</button><button type="button" disabled={running} onClick={() => void run(true)} className="min-h-11 rounded-lg bg-[#507c76] px-4 text-sm text-white disabled:opacity-50">Fill missing IDs</button>{running && <button type="button" onClick={() => { stopped.current = true }} className="min-h-11 px-3 text-sm underline">Stop after this batch</button>}</div>
    <p role="status" className="mt-3 text-sm">{running ? `${mode}…` : rows.length ? 'Finished.' : ''} {rows.length > 0 && `${rows.length} checked · ${rows.filter(row => row.status === 'matched').length} clear matches · ${rows.filter(row => row.status === 'saved').length} saved · ${rows.filter(row => row.status === 'skipped').length} need review`}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {!!rows.length && <div className="mt-4 max-h-80 space-y-3 overflow-auto">{rows.map(row => <div key={row.id} className="border-t pt-3 text-sm"><strong>{row.name} · {row.destination}</strong><p className="text-gray-600">{row.status === 'saved' ? 'ID saved' : row.status === 'matched' ? 'Ready to match' : row.status === 'changed' ? 'Already updated or changed; skipped' : row.reason}</p>{row.matchedName && <p>{row.matchedName} · {row.address}</p>}</div>)}</div>}
  </section>
}
