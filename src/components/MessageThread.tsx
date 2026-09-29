'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { getConversation } from '@/actions/messages'
import MessageComposer, { type ComposerAttachment, type MessageReplyTarget } from './MessageComposer'

type Messages = NonNullable<Awaited<ReturnType<typeof getConversation>>['messages']>

export default function MessageThread({ messages, userId, person, itineraryId, attachment }: { messages: Messages; userId: string; person: { id: string; name: string }; itineraryId?: string; attachment?: ComposerAttachment }) {
  const [replyTo, setReplyTo] = useState<MessageReplyTarget>()
  return <>
    <div className="space-y-4" aria-label="Conversation messages">{messages.map(message => {
      const isOwn = message.senderId === userId
      const messageHref = message.itineraryId ? `/itinerary/${message.itineraryId}${message.placeId ? `#place-${message.placeId}` : ''}` : undefined
      return <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <article id={`message-${message.id}`} className={`w-fit max-w-[88%] rounded-2xl border p-3.5 ${isOwn ? 'rounded-br-sm border-[#c8d2e0] bg-[#e4eaf3]' : 'rounded-bl-sm border-[#d7cebc] bg-[#faf7f1]'}`}>
          <p className={`mb-1.5 text-xs font-semibold text-[#3f5a80] ${isOwn ? 'text-right' : ''}`}>{isOwn ? 'You' : person.name}</p>
          {message.replyTo && <blockquote className="mb-2 rounded-lg border-l-2 border-[#a9b6c8] bg-white/55 px-3 py-2 text-xs text-[#5f6780]">
            <p className="font-semibold text-[#3f5a80]">Replying to {message.replyTo.senderId === userId ? 'you' : person.name}</p>
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words">{message.replyTo.content}</p>
          </blockquote>}
          {(message.placeName || message.itineraryTitle) && <div className="mb-2 text-sm font-semibold text-[#3f5a80]">
            {messageHref ? <Link href={messageHref} className="hover:underline">{message.placeName || message.itineraryTitle}</Link> : <span>{message.placeName || message.itineraryTitle}</span>}
          </div>}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1f3354]">{message.content}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <time className="text-[10px] text-[#8B6F4E]" dateTime={message.createdAt.toISOString()}>{message.createdAt.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</time>
            <button type="button" className="shrink-0 rounded-full border border-[#a9b6c8] px-2.5 py-1 text-xs font-medium text-[#3f5a80] hover:bg-white/60" onClick={() => setReplyTo({ id: message.id, content: message.content, author: isOwn ? 'yourself' : person.name, itineraryTitle: message.itineraryTitle, placeName: message.placeName })}>Reply</button>
          </div>
        </article>
      </div>
    })}</div>
    <MessageComposer recipientId={person.id} itineraryId={itineraryId} attachment={attachment} replyTo={replyTo} onClearReply={() => setReplyTo(undefined)} />
  </>
}
