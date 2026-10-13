'use client'

import { useState } from 'react'
import { deleteAccount } from '@/actions/safety'

// Settings: delete your account and everything in it. Asks you to type DELETE first.
export default function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function remove() {
    if (typed !== 'DELETE' || busy) return
    setBusy(true); setError('')
    try { const result = await deleteAccount(typed); if (result?.error) { setError(result.error); setBusy(false) } }
    catch (caught) {
      // Signing out after deleting redirects, which shows up here as a thrown navigation; anything else is a real error.
      if (!(caught instanceof Error && /NEXT_REDIRECT/.test(caught.message + String((caught as { digest?: string }).digest)))) { setError('Could not delete your account. Please try again.'); setBusy(false) }
    }
  }
  return <section className="panel mt-6 p-5" aria-labelledby="delete-account-heading">
    <h2 id="delete-account-heading" className="type-label text-danger">Delete account</h2>
    {!open ? <>
      <p className="mt-1 text-sm text-muted">Permanently delete your account, trips, photos, comments, messages and snapshots.</p>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline mt-3 text-danger">Delete account…</button>
    </> : <div className="mt-2 space-y-3">
      <p className="text-sm">This deletes your account and everything in it: your trips and plans, photos, comments, likes, saves, follows, messages and snapshots. <strong>It can’t be undone.</strong></p>
      <label className="block text-sm">Type <strong>DELETE</strong> to confirm<input value={typed} onChange={event => setTyped(event.target.value)} autoCapitalize="characters" autoComplete="off" className="field mt-2" /></label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={typed !== 'DELETE' || busy} onClick={() => void remove()} className="btn btn-danger">{busy ? 'Deleting…' : 'Delete my account'}</button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setTyped(''); setError('') }} className="btn btn-outline">Cancel</button>
      </div>
    </div>}
  </section>
}
