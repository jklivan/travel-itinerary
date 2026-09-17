'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import MessageAttachment from './MessageAttachment'
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
  return <form className="mt-6 space-y-3 rounded-xl border border-[#d7cebc] bg-[#FAF7F2] p-4 shadow-sm" onSubmit={event => {
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
    {replyTo && <div className="rounded-lg border-l-4 border-[#507c76] bg-[#e6ece5] p-3 text-sm">
      <p className="font-semibold text-[#507c76]">Replying to {replyTo.author}</p>
      {(replyTo.placeName || replyTo.itineraryTitle) && <p className="mt-1 text-xs text-[#507c76]">{[replyTo.placeName, replyTo.itineraryTitle].filter(Boolean).join(' · ')}</p>}
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words">{replyTo.content}</p>
      <button type="button" disabled={pending} onClick={onClearReply} className="mt-2 text-xs underline">Cancel reply</button>
    </div>}
    {selected && <div className="space-y-2">
      <MessageAttachment name={selected.name} trip={selected.trip} kind={selected.kind} />
      <button type="button" disabled={pending} className="text-xs text-[#8B6F4E] underline" onClick={() => { setSelected(undefined); setShowPicker(false); clientId.current = null }}>Remove attachment</button>
    </div>}
    <label className="block text-sm font-medium text-[#2e4147]">Private message
      <textarea ref={textarea} required={!selected} maxLength={4000} rows={4} value={content} disabled={pending} onChange={event => { setContent(event.target.value); clientId.current = null }} placeholder={replyTo ? 'Write your reply…' : 'Write a message…'} className="mt-2 w-full rounded-xl border-2 border-[#8caaa3] bg-[#fffdf6] p-3 text-base leading-relaxed placeholder:text-[#7a7b70] focus:outline-none focus:ring-2 focus:ring-[#507c76]/25 focus:border-[#507c76]" />
    </label>
    <button type="button" aria-label="Attach an itinerary" aria-expanded={showPicker} disabled={pending} onClick={() => setShowPicker(value => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#8caaa3] px-3 text-sm font-medium text-[#507c76] hover:bg-[#e6ece5] disabled:opacity-50"><span aria-hidden="true" className="text-2xl leading-none">+</span> Add itinerary</button>
    {showPicker && <ItineraryAttachmentPicker disabled={pending} onSelect={trip => { onClearReply?.(); setSelected({ id: trip.id, name: trip.title, kind: 'trip' }); setShowPicker(false); clientId.current = null }} />}
    <p className="text-xs text-[#8B6F4E]">Only you and this traveler can see this conversation.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={pending || (!content.trim() && !selected)} className="rounded-full bg-[#507c76] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#355650] transition-colors disabled:opacity-50">{pending ? 'Sending…' : 'Send message'}</button>
  </form>
}
