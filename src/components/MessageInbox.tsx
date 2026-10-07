'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import UserAvatar from './UserAvatar'
import { messageThreadHref } from '@/lib/messageThread'

export type InboxPerson = {
  person: { id: string; name: string; image: string | null }
  threads: { itineraryId: string | null; title: string; placeName: string | null; content: string; createdAt: string; unread: number }[]
}

// Messages grouped by person: each person's conversations (general, and one per trip) underneath, newest first.
// A person's section folds up with the arrow. Conversations with unread messages keep a blue edge and an "N new" badge.
export default function MessageInbox({ people }: { people: InboxPerson[] }) {
  const [closed, setClosed] = useState<string[]>([])
  return <div className="divide-y divide-line">{people.map(({ person, threads }) => {
    const open = !closed.includes(person.id)
    const unread = threads.reduce((sum, thread) => sum + thread.unread, 0)
    return <section key={person.id} aria-label={person.name} className="py-5 first:pt-0">
      <button type="button" aria-expanded={open} onClick={() => setClosed(current => open ? [...current, person.id] : current.filter(id => id !== person.id))} className="flex w-full items-center gap-4 text-left">
        <UserAvatar name={person.name} image={person.image} size={56} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="type-title block [overflow-wrap:anywhere]">{person.name}</span>
          <span className="type-meta mt-1 block">{threads.length} {threads.length === 1 ? 'conversation' : 'conversations'}{unread > 0 && <span className="font-semibold text-link"> · {unread} new</span>}</span>
        </span>
        <ChevronDown size={22} aria-hidden="true" className={`shrink-0 text-link transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-4 space-y-3">{threads.map(thread => <Link key={thread.itineraryId ?? 'general'} href={messageThreadHref(person.id, thread.itineraryId)}
        className={`panel flex items-center gap-3 p-4 transition-colors hover:border-link ${thread.unread ? 'border-l-4 !border-link' : ''}`}>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><span className="type-card normal-case tracking-normal">{thread.title}</span>{thread.unread > 0 && <span className="rounded-full bg-link px-2 py-0.5 text-xs font-semibold text-white">{thread.unread} new</span>}</span>
          {thread.placeName && <span className="type-meta mt-0.5 block">📍 {thread.placeName}</span>}
          <span className={`mt-1 line-clamp-1 block break-words text-sm ${thread.unread ? 'font-semibold text-ink' : 'text-muted'}`}>{thread.content}</span>
        </span>
        <time className="type-meta shrink-0" dateTime={thread.createdAt}>{new Date(thread.createdAt).toLocaleDateString('en-US')}</time>
        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-link" />
      </Link>)}</div>}
    </section>
  })}</div>
}
