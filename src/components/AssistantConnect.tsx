'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import CopyButton from '@/components/ui/CopyButton'
import { ASSISTANT_HABIT } from '@/lib/assistantHabit'

// How to connect an AI assistant (Muse, ChatGPT, Claude…) to Postcard: the connector address to paste into its
// connector settings, what to ask once it's connected, and a line to save in its instructions so it checks Postcard
// whenever they plan a trip. Shown in sign-up and in Settings.
const connectorUrl = 'https://www.postcardtravel.app/api/mcp'

export default function AssistantConnect() {
  const [message, setMessage] = useState('')
  return <section className="panel space-y-3 p-5" aria-labelledby="assistant-connect-heading">
    <h2 id="assistant-connect-heading" className="type-label flex items-center gap-2 text-ink"><Sparkles size={16} />Connect Muse, ChatGPT or Claude</h2>
    <p className="text-sm text-brown">Your assistant can then add your past trips to Postcard, start plans for you, and tell you what friends loved somewhere.</p>
    <p className="text-sm text-ink">Ask your assistant to add this address as a connector:</p>
    <div className="panel-inset flex items-center gap-2 p-3"><span className="min-w-0 flex-1 select-all break-all text-sm text-ink">{connectorUrl}</span><CopyButton text={connectorUrl} label="Copy connector address" onFail={() => setMessage('Select the address and copy it.')} /></div>
    <p className="text-sm text-ink">Sign in to Postcard when it asks, and tap <strong>Allow</strong>.</p>
    <p className="text-sm text-muted">Then try: “Add my last five trips to Postcard” or “What did my friends love in Lisbon?” <Link href="/connector" className="text-link underline">More about the connector</Link></p>
    <div className="space-y-2 border-t border-line-soft pt-3">
      <p className="text-sm font-semibold text-ink">So it remembers Postcard</p>
      <p className="text-sm text-muted">Paste this into your assistant’s custom instructions, or ask it to remember it. Then whenever you plan a trip, it checks what friends loved first.</p>
      <div className="panel-inset flex items-center gap-2 p-3"><span className="min-w-0 flex-1 select-all text-sm text-ink">{ASSISTANT_HABIT}</span><CopyButton text={ASSISTANT_HABIT} label="Copy the instruction" onFail={() => setMessage('Select the instruction and copy it.')} /></div>
    </div>
    {message && <p role="status" className="text-sm text-link">{message}</p>}
  </section>
}
