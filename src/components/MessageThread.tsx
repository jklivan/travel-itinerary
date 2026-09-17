'use client'

import { useState } from 'react'
import type { getConversation } from '@/actions/messages'
import MessageAttachment from './MessageAttachment'
import MessageComposer, { type ComposerAttachment, type MessageReplyTarget } from './MessageComposer'

type Messages = NonNullable<Awaited<ReturnType<typeof getConversation>>['messages']>

export default function MessageThread({ messages, userId, person, attachment }: { messages: Messages; userId: string; person: { id: string; name: string }; attachment?: ComposerAttachment }) {
  const [replyTo, setReplyTo] = useState<MessageReplyTarget>()
  return <>
    <div className="space-y-4">{messages.map(message => <article id={`message-${message.id}`} key={message.id} className={`rounded-xl border border-[#d7cebc] p-4 shadow-sm ${message.senderId === userId ? 'ml-6 rounded-br-sm bg-[#e6ece5]' : 'mr-6 rounded-bl-sm bg-[#FAF7F2]'}`}>
      <p className="text-xs font-semibold text-[#507c76] mb-2">{message.senderId === userId ? 'You' : person.name}</p>
      {message.replyTo && <blockquote className="mb-3 rounded-md border-l-4 border-[#507c76] bg-white/50 p-3 text-sm text-[#6b7067]">
        <p className="font-semibold text-[#507c76]">Reply to {message.replyTo.senderId === userId ? 'you' : person.name}</p>
        {(message.replyTo.placeName || message.replyTo.itineraryTitle) && <p className="mt-1 text-xs">{[message.replyTo.placeName, message.replyTo.itineraryTitle].filter(Boolean).join(' · ')}</p>}
        <p className="mt-1 whitespace-pre-wrap break-words">{message.replyTo.content}</p>
      </blockquote>}
      {(message.placeName || message.itineraryTitle) && <div className="mb-3"><MessageAttachment kind={message.placeName ? 'place' : 'trip'} name={message.placeName || message.itineraryTitle!} trip={message.placeName ? message.itineraryTitle : undefined} notes={message.placeNotes} href={message.itineraryId ? `/itinerary/${message.itineraryId}${message.placeId ? `#place-${message.placeId}` : ''}` : undefined} /></div>}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#2e4147]">{message.content}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <time className="text-xs text-[#8B6F4E]" dateTime={message.createdAt.toISOString()}>{message.createdAt.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</time>
        <button type="button" className="shrink-0 rounded-full border border-[#8caaa3] px-3 py-1.5 text-sm font-medium text-[#507c76] hover:bg-[#e6ece5]" onClick={() => setReplyTo({ id: message.id, content: message.content, author: message.senderId === userId ? 'yourself' : person.name, itineraryTitle: message.itineraryTitle, placeName: message.placeName })}>Reply</button>
      </div>
    </article>)}</div>
    <MessageComposer recipientId={person.id} attachment={attachment} replyTo={replyTo} onClearReply={() => setReplyTo(undefined)} />
  </>
}
