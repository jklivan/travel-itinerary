'use client'

import { useState } from 'react'
import Link from 'next/link'
import { setTripGroup } from './actions'

type Row = { id: string; title: string; author: string; posted: boolean; places: number; joined: number; guess: { audience: 'romantic' | 'friends'; reason: string } | null }

// Each Adults trip with the AI's guess preselected; tap to change, then apply them all at once.
export default function AdultsList({ rows }: { rows: Row[] }) {
  const [choice, setChoice] = useState<Record<string, string>>(() => Object.fromEntries(rows.flatMap(row => row.guess ? [[row.id, row.guess.audience]] : [])))
  const [state, setState] = useState<'idle' | 'saving' | 'done' | string>('idle')
  const chosen = Object.entries(choice).map(([id, audience]) => ({ id, audience }))
  return <div className="space-y-3">
    {rows.map(row => <article key={row.id} className="panel space-y-2 p-4">
      <p className="text-sm"><Link href={`/itinerary/${row.id}?as=guest`} className="font-semibold text-link underline">{row.title}</Link> <span className="text-muted">by {row.author} · {row.posted ? 'posted' : 'private'} · {row.places} places{row.joined ? ` · ${row.joined} joined` : ''}</span></p>
      {row.guess ? <p className="text-xs text-muted">AI: {row.guess.audience === 'romantic' ? 'Couples' : 'Friends'}. {row.guess.reason}</p> : <p className="text-xs text-muted">AI couldn’t tell. Choose one.</p>}
      <div className="flex gap-2">{([['romantic', 'Couples'], ['friends', 'Friends']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={choice[row.id] === value} onClick={() => setChoice(current => ({ ...current, [row.id]: value }))} className="chip">{label}</button>)}</div>
    </article>)}
    <div className="flex items-center gap-3">
      <button type="button" disabled={state === 'saving' || !chosen.length} onClick={async () => { setState('saving'); const result = await setTripGroup(chosen).catch(() => ({ error: 'Could not save.' })); setState(result.error ?? 'done') }} className="btn btn-primary">{state === 'saving' ? 'Saving…' : `Apply ${chosen.length}`}</button>
      {state === 'done' && <span role="status" className="text-sm text-link">Saved.</span>}
      {state !== 'idle' && state !== 'saving' && state !== 'done' && <span role="alert" className="text-sm text-danger">{state}</span>}
    </div>
  </div>
}
