'use client'

import { useState } from 'react'
import { Copy, Mail, X } from 'lucide-react'
import { createInbox, setInboxSender } from '@/actions/inbox'

// Settings → Send trips to Postcard: a private email address. Booking confirmations and trip summaries sent to it
// (by you, or your assistant from an address you allow) become private plans, or join the one they belong to.
export default function TripInbox({ initialAddress, initialSenders, accountEmail }: { initialAddress: string | null; initialSenders: string[]; accountEmail: string }) {
  const [address, setAddress] = useState(initialAddress)
  const [senders, setSenders] = useState(initialSenders)
  const [newSender, setNewSender] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function run(action: () => Promise<{ address?: string; senders?: string[]; error?: string }>, done?: string) {
    setBusy(true); setMessage('')
    try { const result = await action(); if (result.address) setAddress(result.address); if (result.senders) setSenders(result.senders); setMessage(result.error ?? done ?? '') }
    catch { setMessage('Couldn’t save. Please try again.') } finally { setBusy(false) }
  }
  async function copy() {
    if (!address) return
    try { await navigator.clipboard.writeText(address); setMessage('Copied.') } catch { setMessage('Select the address and copy it.') }
  }

  return <section className="panel mt-6 space-y-3 p-5" aria-labelledby="inbox-heading">
    <h2 id="inbox-heading" className="type-label text-ink">Send trips to Postcard</h2>
    <p className="text-sm text-brown">Email booking confirmations or a trip summary to your private address, or ask your assistant to. Postcard adds the places to the private plan they belong to, or starts a new one, and emails you back.</p>
    {!address ? <button type="button" disabled={busy} onClick={() => void run(() => createInbox())} className="btn btn-primary btn-sm"><Mail size={16} />Get my address</button> : <>
      <div className="panel-inset flex items-center gap-2 p-3"><span className="min-w-0 flex-1 select-all break-words text-sm text-ink">{address}</span><button type="button" onClick={() => void copy()} aria-label="Copy address" className="btn-icon"><Copy size={18} /></button></div>
      <div className="space-y-2">
        <p className="text-sm text-ink">Accepted from</p>
        <ul className="space-y-1.5 text-sm text-ink">
          <li className="text-muted">{accountEmail} (your account)</li>
          {senders.map(sender => <li key={sender} className="flex items-center justify-between gap-2"><span className="min-w-0 break-all">{sender}</span><button type="button" disabled={busy} onClick={() => void run(() => setInboxSender(sender, false))} aria-label={`Stop accepting email from ${sender}`} className="btn-icon"><X size={18} /></button></li>)}
        </ul>
        <form noValidate className="flex gap-2" onSubmit={event => { event.preventDefault(); const value = newSender; void run(() => setInboxSender(value, true), 'Added.').then(() => setNewSender('')) }}>
          <label className="min-w-0 flex-1"><span className="sr-only">Also accept email from</span><input id="inbox-sender" type="email" value={newSender} onChange={event => setNewSender(event.target.value)} placeholder="Also accept from, e.g. your assistant" className="field w-full" /></label>
          <button type="submit" disabled={busy || !newSender.trim()} className="btn btn-outline btn-sm">Add</button>
        </form>
        <p className="text-xs text-muted">Only email that really comes from these addresses is used. Anything else is ignored.</p>
      </div>
      {!confirmReset ? <button type="button" onClick={() => setConfirmReset(true)} className="text-sm text-link underline underline-offset-2">Get a new address</button>
        : <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-ink">The old address will stop working.</span><button type="button" disabled={busy} onClick={() => { setConfirmReset(false); void run(() => createInbox(true), 'New address ready.') }} className="btn btn-outline btn-sm">Get a new address</button><button type="button" onClick={() => setConfirmReset(false)} className="btn btn-outline btn-sm">Keep this one</button></div>}
    </>}
    {message && <p role="status" className="text-sm text-link">{message}</p>}
  </section>
}
