'use client'

import { useState } from 'react'
import { Copy, Sparkles } from 'lucide-react'

// How to connect an AI assistant (Muse, ChatGPT, Claude…) to Postcard: the connector address to paste into its
// connector settings, and what to ask once it's connected. Shown in sign-up and in Settings.
const connectorUrl = 'https://www.postcardtravel.app/api/mcp'

export default function AssistantConnect() {
  const [message, setMessage] = useState('')
  async function copy() {
    try { await navigator.clipboard.writeText(connectorUrl); setMessage('Copied.') } catch { setMessage('Select the address and copy it.') }
  }
  return <section className="panel space-y-3 p-5" aria-labelledby="assistant-connect-heading">
    <h2 id="assistant-connect-heading" className="type-label flex items-center gap-2 text-ink"><Sparkles size={16} />Connect Muse, ChatGPT or Claude</h2>
    <p className="text-sm text-brown">Your assistant can then add your past trips to Postcard, start plans for you, and tell you what friends loved somewhere.</p>
    <p className="text-sm text-ink">Ask your assistant to add this address as a connector:</p>
    <div className="panel-inset flex items-center gap-2 p-3"><span className="min-w-0 flex-1 select-all break-all text-sm text-ink">{connectorUrl}</span><button type="button" onClick={() => void copy()} aria-label="Copy connector address" className="btn-icon"><Copy size={18} /></button></div>
    <p className="text-sm text-ink">Sign in to Postcard when it asks, and tap <strong>Allow</strong>.</p>
    <p className="text-sm text-muted">Then try: “Add my last five trips to Postcard” or “What did my friends love in Lisbon?”</p>
    {message && <p role="status" className="text-sm text-link">{message}</p>}
  </section>
}
