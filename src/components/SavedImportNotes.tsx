'use client'

import { useEffect, useState } from 'react'
import { getImportNotes, listImportNotes } from '@/actions/importNotes'

export default function SavedImportNotes({ refreshKey, disabled, onRestore }: {
  refreshKey: number; disabled: boolean; onRestore: (text: string) => void
}) {
  const [notes, setNotes] = useState<Awaited<ReturnType<typeof listImportNotes>>>([])
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    listImportNotes().then(rows => { if (active) { setNotes(rows); setError('') } })
      .catch(() => { if (active) setError('Could not load saved notes.') })
    return () => { active = false }
  }, [refreshKey, retry])
  async function restore(id: string) {
    setLoadingId(id)
    setError('')
    try {
      const result = await getImportNotes(id)
      if (result.text !== undefined) onRestore(result.text)
      else setError(result.error ?? 'Could not recover notes.')
    } catch { setError('Could not recover notes. Please try again.') }
    finally { setLoadingId(null) }
  }
  if (!notes.length && !error) return null
  return <details className="rounded-xl border border-line bg-cream p-4">
    <summary className="cursor-pointer text-sm font-semibold text-link">Recover saved notes{notes.length ? ` (${notes.length})` : ''}</summary>
    <p className="mt-2 text-xs text-muted">Your last 20 saved imports. Only you can access these notes. Choose one to try importing again.</p>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">Retry</button></p>}
    <ul className="mt-3 space-y-2">{notes.map(note => <li key={note.id}>
      <button type="button" disabled={disabled || loadingId !== null} onClick={() => restore(note.id)} className="w-full rounded-lg border border-line bg-white p-3 text-left disabled:opacity-50">
        <span className="block line-clamp-2 whitespace-pre-wrap break-words text-sm text-ink">{note.preview}</span>
        <span className="mt-1 block text-xs text-muted">{loadingId === note.id ? 'Recovering…' : new Date(note.createdAt).toLocaleString()}</span>
      </button>
    </li>)}</ul>
  </details>
}
