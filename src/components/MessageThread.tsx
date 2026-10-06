'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { getConversation } from '@/actions/messages'
import MessageComposer, { type ComposerAttachment, type MessageReplyTarget } from './MessageComposer'

type Messages = NonNullable<Awaited<ReturnType<typeof getConversation>>['messages']>

export default function MessageThread({ messages, newIds = [], userId, person, itineraryId, attachment }: { messages: Messages; newIds?: string[]; userId: string; person: { id: string; name: string }; itineraryId?: string; attachment?: ComposerAttachment }) {
  const [replyTo, setReplyTo] = useState<MessageReplyTarget>()
  // The page refreshes every few seconds and the messages get marked read, so remember which were new for as long
  // as this conversation is open (ones that arrive meanwhile are added).
  const [seenNew, setSeenNew] = useState(newIds)
  const newKey = newIds.join(',')
  const [lastNewKey, setLastNewKey] = useState(newKey)
  if (newKey !== lastNewKey) { setLastNewKey(newKey); if (newKey) setSeenNew([...new Set([...seenNew, ...newIds])]) }
  return <>
    <div className="space-y-4" aria-label="Conversation messages">{messages.map(message => {
      const isOwn = message.senderId === userId
      const messageHref = message.itineraryId ? `/itinerary/${message.itineraryId}${message.placeId ? `#place-${message.placeId}` : ''}` : undefined
      // Messages you hadn't opened yet: a "New messages" line above the first, and a highlight on each.
      const isNew = seenNew.includes(message.id)
      return <div key={message.id}>
        {isNew && message.id === messages.find(other => seenNew.includes(other.id))?.id && <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-link before:h-px before:flex-1 before:bg-link after:h-px after:flex-1 after:bg-link">New messages</p>}
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <article id={`message-${message.id}`} className={`w-fit max-w-[88%] rounded-2xl border p-3.5 ${isOwn ? 'rounded-br-sm border-mist-line bg-mist' : isNew ? 'rounded-bl-sm border-2 border-link bg-card' : 'rounded-bl-sm border-line bg-cream'}`}>
          <p className={`mb-1.5 text-xs font-semibold text-link ${isOwn ? 'text-right' : ''}`}>{isOwn ? 'You' : person.name}</p>
          {message.replyTo && <blockquote className="mb-2 rounded-lg border-l-2 border-mist-edge bg-white/55 px-3 py-2 text-xs text-muted">
            <p className="font-semibold text-link">Replying to {message.replyTo.senderId === userId ? 'you' : person.name}</p>
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words">{message.replyTo.content}</p>
          </blockquote>}
          {(message.placeName || message.itineraryTitle) && <div className="mb-2 text-sm font-semibold text-link">
            {messageHref ? <Link href={messageHref} className="hover:underline">{message.placeName || message.itineraryTitle}</Link> : <span>{message.placeName || message.itineraryTitle}</span>}
          </div>}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{message.content}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <time className="text-[10px] text-brown" dateTime={message.createdAt.toISOString()}>{message.createdAt.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</time>
            <button type="button" className="shrink-0 rounded-full border border-mist-edge px-2.5 py-1 text-xs font-medium text-link hover:bg-white/60" onClick={() => setReplyTo({ id: message.id, content: message.content, author: isOwn ? 'yourself' : person.name, itineraryTitle: message.itineraryTitle, placeName: message.placeName })}>Reply</button>
          </div>
        </article>
        </div>
      </div>
    })}</div>
    <MessageComposer recipientId={person.id} itineraryId={itineraryId} attachment={attachment} replyTo={replyTo} onClearReply={() => setReplyTo(undefined)} />
  </>
}
