'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import UserAvatar from './UserAvatar'
import { markTripChatRead, sendTripMessage, tripMessages, type TripChatMessage } from '@/actions/tripChat'

// A group trip's chat (#116), at the bottom of the plan: only the people on the trip see it. New messages appear
// while it's open (checked every few seconds while the page is visible).
export default function TripChat({ tripId, viewerId }: { tripId: string; viewerId: string }) {
  const [messages, setMessages] = useState<TripChatMessage[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const latest = useRef<string | undefined>(undefined)

  useEffect(() => {
    let active = true
    const add = (rows: TripChatMessage[]) => {
      if (!rows.length) return
      latest.current = rows[rows.length - 1].at
      setMessages(current => { const seen = new Set((current ?? []).map(row => row.id)); return [...(current ?? []), ...rows.filter(row => !seen.has(row.id))] })
    }
    void tripMessages(tripId).then(rows => { if (!active) return; setMessages(rows); latest.current = rows.at(-1)?.at })
    void markTripChatRead(tripId)
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void tripMessages(tripId, latest.current).then(rows => { if (active && rows.length) { add(rows); void markTripChatRead(tripId) } }).catch(() => {})
    }, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [tripId])

  // Keep the newest message in view.
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }) }, [messages?.length])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true); setError('')
    try {
      const result = await sendTripMessage(tripId, text)
      if (result.error || !result.message) { setError(result.error ?? 'Could not send. Please try again.'); return }
      const message = result.message
      latest.current = message.at
      setMessages(current => [...(current ?? []), message]); setDraft('')
    } catch { setError('Could not send. Please try again.') } finally { setSending(false) }
  }

  const when = (iso: string) => {
    const date = new Date(iso), today = new Date().toDateString() === date.toDateString()
    return date.toLocaleString('en-US', today ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  return <section id="trip-chat" aria-labelledby="trip-chat-heading" className="panel mt-8 scroll-mt-24 p-4">
    <h2 id="trip-chat-heading" className="flex items-center gap-2 type-label text-ink"><MessageCircle size={16} />Trip chat</h2>
    <p className="mt-1 text-xs text-muted">Just the people on this trip see it.</p>
    <div ref={list} className="mt-3 max-h-96 space-y-3 overflow-y-auto">
      {messages === null ? <p className="text-sm text-muted">Loading…</p>
        : !messages.length ? <p className="text-sm text-muted">No messages yet. Say hi, or ask what everyone thinks.</p>
        : messages.map(message => <div key={message.id} className="flex items-start gap-2">
          <UserAvatar name={message.name} image={message.image} size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted"><span className="font-semibold text-ink">{message.userId === viewerId ? 'You' : message.name.split(' ')[0]}</span> · {when(message.at)}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">{message.body}</p>
          </div>
        </div>)}
    </div>
    <form onSubmit={event => void send(event)} className="mt-3 flex items-end gap-2">
      <label className="min-w-0 flex-1"><span className="sr-only">Message</span>
        <textarea value={draft} onChange={event => setDraft(event.target.value)} rows={1} maxLength={2000} placeholder="Message the group…" className="field max-h-32 min-h-11 w-full resize-y"
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(event) } }} />
      </label>
      <button type="submit" disabled={sending || !draft.trim()} aria-label="Send" className="btn btn-primary btn-icon"><Send size={18} /></button>
    </form>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </section>
}
