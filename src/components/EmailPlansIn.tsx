'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Sparkles } from 'lucide-react'
import CopyButton from '@/components/ui/CopyButton'
import { createInbox } from '@/actions/inbox'

const CONNECTOR_URL = 'https://www.postcardtravel.app/api/mcp'

// Plan with Postcard's "Email plans in, or have your AI assistant send them", unfolded: your Postcard address to
// forward plans to (or a button to get one), then how to connect an assistant (Settings → Send trips to Postcard
// and Connect an AI assistant have the same, with more options).
export default function EmailPlansIn({ initialAddress }: { initialAddress: string | null }) {
  const [address, setAddress] = useState(initialAddress)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function getAddress() {
    setBusy(true); setError('')
    try { const result = await createInbox(); if (result.address) setAddress(result.address); else setError(result.error ?? 'Couldn’t make your address. Please try again.') }
    catch { setError('Couldn’t make your address. Please try again.') } finally { setBusy(false) }
  }
  return <div className="space-y-5 border-t border-line-soft px-4 pb-4 pt-4 text-sm">
    <section className="space-y-2">
      <h3 className="type-label flex items-center gap-2 text-ink"><Mail size={16} />Email it to Postcard</h3>
      <p className="text-muted">Forward booking confirmations, an itinerary or notes to your Postcard address. Postcard adds the places to the plan they belong to, or starts a new one, and emails you back.</p>
      {address ? <div className="panel-inset flex items-center gap-2 p-3"><span className="min-w-0 flex-1 select-all break-all text-ink">{address}</span><CopyButton text={address} label="Copy your Postcard address" /></div>
        : <button type="button" disabled={busy} onClick={() => void getAddress()} className="btn btn-primary btn-sm"><Mail size={16} />{busy ? 'Making your address…' : 'Get my address'}</button>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {address && <p className="text-muted">Only email from your account is accepted. If an assistant emails from its own address, add it in <Link href="/settings/email" className="text-link underline">Send trips to Postcard</Link>.</p>}
    </section>
    <section className="space-y-2">
      <h3 className="type-label flex items-center gap-2 text-ink"><Sparkles size={16} />Or have your AI assistant do it</h3>
      <p className="text-muted">Connect Muse, ChatGPT or Claude: ask it to add this address as a connector, then sign in to Postcard when it asks and tap <strong>Allow</strong>.</p>
      <div className="panel-inset flex items-center gap-2 p-3"><span className="min-w-0 flex-1 select-all break-all text-ink">{CONNECTOR_URL}</span><CopyButton text={CONNECTOR_URL} label="Copy connector address" /></div>
      <p className="text-muted">Then ask it: “Add my last five trips to Postcard” or “Send this itinerary to Postcard.” <Link href="/connector" className="text-link underline">More about the connector</Link></p>
    </section>
  </div>
}
