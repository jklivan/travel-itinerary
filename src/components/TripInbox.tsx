'use client'

import { useState } from 'react'
import { Copy, Mail, X } from 'lucide-react'
import { createInbox, renameInbox, setInboxSender } from '@/actions/inbox'

// Settings → Send trips to Postcard: a private email address. Booking confirmations and trip summaries sent to it
// (by you, or your assistant from an address you allow) become private plans, or join the one they belong to.
export default function TripInbox({ initialAddress, initialSenders, accountEmail }: { initialAddress: string | null; initialSenders: string[]; accountEmail: string }) {
  const [address, setAddress] = useState(initialAddress)
  const [senders, setSenders] = useState(initialSenders)
  const [newSender, setNewSender] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function run(action: () => Promise<{ address?: string; senders?: string[]; error?: string }>, done?: string) {
    setBusy(true); setMessage('')
    try { const result = await action(); if (result.address) setAddress(result.address); if (result.senders) setSenders(result.senders); setMessage(result.error ?? done ?? ''); return !result.error }
    catch { setMessage('Couldn’t save. Please try again.'); return false } finally { setBusy(false) }
  }
  async function copy() {
    if (!address) return
    try { await navigator.clipboard.writeText(address); setMessage('Copied.') } catch { setMessage('Select the address and copy it.') }
  }

  return <section className="panel mt-6 space-y-3 p-5" aria-labelledby="inbox-heading">
    <h2 id="inbox-heading" className="type-label text-ink">Send trips to Postcard</h2>
    <p className="text-sm text-brown">Email booking confirmations or a trip summary to your Postcard address, or ask your assistant to. Postcard adds the places to the private plan they belong to, or starts a new one, and emails you back.</p>
    {!address ? <button type="button" disabled={busy} onClick={() => void run(() => createInbox())} className="btn btn-primary btn-sm"><Mail size={16} />Get my address</button> : <>
      <div className="panel-inset flex items-center gap-2 p-3"><span className="min-w-0 flex-1 select-all break-words text-sm text-ink">{address}</span><button type="button" onClick={() => void copy()} aria-label="Copy address" className="btn-icon"><Copy size={18} /></button></div>
      <div className="space-y-2">
        <p className="text-sm text-ink">Accepted from</p>
        <ul className="space-y-1.5 text-sm text-ink">
          <li className="text-muted">{accountEmail} (your account)</li>
          {senders.map(sender => <li key={sender} className="flex items-center justify-between gap-2"><span className="min-w-0 break-all">{sender}</span><button type="button" disabled={busy} onClick={() => void run(() => setInboxSender(sender, false))} aria-label={`Stop accepting email from ${sender}`} className="btn-icon"><X size={18} /></button></li>)}
        </ul>
        <form noValidate className="flex gap-2" onSubmit={event => { event.preventDefault(); const value = newSender; void run(() => setInboxSender(value, true), 'Added.').then(ok => { if (ok) setNewSender('') }) }}>
          <label className="min-w-0 flex-1"><span className="sr-only">Also accept email from</span><input id="inbox-sender" type="email" value={newSender} onChange={event => setNewSender(event.target.value)} placeholder="Also accept from, e.g. your assistant" className="field w-full" /></label>
          <button type="submit" disabled={busy || !newSender.trim()} className="btn btn-outline btn-sm">Add</button>
        </form>
        <p className="text-xs text-muted">Only email that really comes from these addresses is used. Anything else is ignored.</p>
      </div>
      {!renaming ? <button type="button" onClick={() => { setRenaming(true); setNewName(address.split('@')[0]) }} className="text-sm text-link underline underline-offset-2">Change address</button>
        : <form noValidate className="space-y-2" onSubmit={event => { event.preventDefault(); const value = newName; void run(() => renameInbox(value), 'Address changed.').then(ok => { if (ok) setRenaming(false) }) }}>
          <label className="block text-sm text-ink" htmlFor="inbox-name">Your address</label>
          <div className="flex items-center gap-1.5"><input id="inbox-name" value={newName} onChange={event => setNewName(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="field min-w-0 flex-1" /><span className="shrink-0 text-sm text-muted">@in.postcardtravel.app</span></div>
          <p className="text-xs text-muted">Something you’ll remember, like your family name. The old address stops working.</p>
          <div className="flex gap-2"><button type="submit" disabled={busy || !newName.trim()} className="btn btn-primary btn-sm">Save</button><button type="button" onClick={() => setRenaming(false)} className="btn btn-outline btn-sm">Cancel</button></div>
        </form>}
    </>}
    {message && <p role="status" className="text-sm text-link">{message}</p>}
  </section>
}
