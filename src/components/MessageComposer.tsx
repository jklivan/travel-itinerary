'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import MessageAttachment from './MessageAttachment'
import { sendDirectMessage } from '@/actions/messages'

export default function MessageComposer({ recipientId, attachment }: { recipientId: string; attachment?: { id: string; name: string; trip: string } }) {
  const [content, setContent] = useState('')
  const [attached, setAttached] = useState(!!attachment)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const clientId = useRef<string | null>(null)
  const router = useRouter()
  return <form className="mt-6 space-y-3 rounded-xl border border-[#d7cebc] bg-[#FAF7F2] p-4 shadow-sm" onSubmit={event => {
    event.preventDefault()
    if (pending) return
    setError('')
    clientId.current ??= crypto.randomUUID()
    startTransition(async () => {
      try {
        const result = await sendDirectMessage({ recipientId, content, clientId: clientId.current!, placeId: attached ? attachment?.id : undefined })
        if (result.error) { setError(result.error); return }
        setContent(''); setAttached(false); clientId.current = null
        router.replace(`/messages/${recipientId}`, { scroll: false })
        router.refresh()
      } catch { setError('Could not send. Your message is still here—please try again.') }
    })
  }}>
    {attached && attachment && <div className="space-y-2">
      <MessageAttachment name={attachment.name} trip={attachment.trip} />
      <button type="button" disabled={pending} className="text-xs text-[#8B6F4E] underline" onClick={() => { setAttached(false); clientId.current = null }}>Remove attachment</button>
    </div>}
    <label className="block text-sm font-medium text-[#2e4147]">Private message
      <textarea required maxLength={4000} rows={4} value={content} disabled={pending} onChange={event => { setContent(event.target.value); clientId.current = null }} placeholder="Ask about this trip or place…" className="mt-2 w-full rounded-xl border-2 border-[#8caaa3] bg-[#fffdf6] p-3 text-base leading-relaxed placeholder:text-[#7a7b70] focus:outline-none focus:ring-2 focus:ring-[#507c76]/25 focus:border-[#507c76]" />
    </label>
    <p className="text-xs text-[#8B6F4E]">Only you and this traveler can see this conversation.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={pending || !content.trim()} className="rounded-full bg-[#507c76] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#355650] transition-colors disabled:opacity-50">{pending ? 'Sending…' : 'Send message'}</button>
  </form>
}
