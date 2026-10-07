'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import MessageAttachment from './MessageAttachment'
import { Plus } from 'lucide-react'
import ItineraryAttachmentPicker from './ItineraryAttachmentPicker'
import { sendDirectMessage } from '@/actions/messages'
import { messageThreadHref } from '@/lib/messageThread'

export type MessageReplyTarget = { id: string; content: string; author: string; itineraryTitle?: string | null; placeName?: string | null }
export type ComposerAttachment = { id: string; name: string; trip?: string; kind: 'place' | 'trip' }

export default function MessageComposer({ recipientId, itineraryId, attachment, replyTo, onClearReply }: { recipientId: string; itineraryId?: string; attachment?: ComposerAttachment; replyTo?: MessageReplyTarget; onClearReply?: () => void }) {
  const [content, setContent] = useState('')
  const [selected, setSelected] = useState(attachment)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const clientId = useRef<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  useEffect(() => {
    clientId.current = null
    if (replyTo) textarea.current?.focus()
  }, [replyTo])
  return <form className="mt-6 space-y-3 rounded-xl border border-line bg-cream p-4 shadow-card" onSubmit={event => {
    event.preventDefault()
    if (pending) return
    setError('')
    clientId.current ??= crypto.randomUUID()
    startTransition(async () => {
      try {
        const result = await sendDirectMessage({ recipientId, content, clientId: clientId.current!, replyToId: replyTo?.id, placeId: selected?.kind === 'place' ? selected.id : undefined, itineraryId: selected?.kind === 'trip' ? selected.id : selected?.kind === 'place' ? undefined : itineraryId })
        if (result.error) { setError(result.error); return }
        setContent(''); setSelected(undefined); setShowPicker(false); clientId.current = null
        onClearReply?.()
        router.replace(messageThreadHref(recipientId, result.itineraryId ?? itineraryId), { scroll: false })
        router.refresh()
      } catch { setError('Could not send. Your message is still here—please try again.') }
    })
  }}>
    {replyTo && <div className="rounded-lg border-l-4 border-link bg-mist p-3 text-sm">
      <p className="font-semibold text-link">Replying to {replyTo.author}</p>
      {(replyTo.placeName || replyTo.itineraryTitle) && <p className="mt-1 text-xs text-link">{[replyTo.placeName, replyTo.itineraryTitle].filter(Boolean).join(' · ')}</p>}
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words">{replyTo.content}</p>
      <button type="button" disabled={pending} onClick={onClearReply} className="mt-2 text-xs underline">Cancel reply</button>
    </div>}
    {selected && <div className="space-y-2">
      <MessageAttachment name={selected.name} trip={selected.trip} kind={selected.kind} />
      <button type="button" disabled={pending} className="text-xs text-brown underline" onClick={() => { setSelected(undefined); setShowPicker(false); clientId.current = null }}>Remove attachment</button>
    </div>}
    <label className="block text-sm font-medium text-ink">Private message
      <textarea ref={textarea} required={!selected} maxLength={4000} rows={4} value={content} disabled={pending} onChange={event => { setContent(event.target.value); clientId.current = null }} placeholder={replyTo ? 'Write your reply…' : 'Write a message…'} className="mt-2 w-full rounded-xl border-2 border-mist-edge bg-card p-3 text-base leading-relaxed placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-link/25 focus:border-link" />
    </label>
    {/* Send right under the message, since that's what you usually want; attaching a trip is the extra. */}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button disabled={pending || (!content.trim() && !selected)} className="btn btn-primary">{pending ? 'Sending…' : 'Send message'}</button>
      <button type="button" aria-label="Attach an itinerary" aria-expanded={showPicker} disabled={pending} onClick={() => setShowPicker(value => !value)} className="chip"><Plus size={14} />Add itinerary</button>
    </div>
    {showPicker && <ItineraryAttachmentPicker disabled={pending} onSelect={trip => { onClearReply?.(); setSelected({ id: trip.id, name: trip.title, kind: 'trip' }); setShowPicker(false); clientId.current = null }} />}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <p className="text-xs text-brown">Only you and this traveler can see this conversation.</p>
  </form>
}
