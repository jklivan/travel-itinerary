import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMessageInbox } from '@/actions/messages'
import { getForumReplyInbox } from '@/actions/questions'
import { openNotification } from '@/actions/notifications'
import MessageRefresh from '@/components/MessageRefresh'
import { messageThreadHref } from '@/lib/messageThread'

export default async function InboxPage() {
  const [result, forumReplies] = await Promise.all([getMessageInbox(), getForumReplyInbox()])
  if (!result.threads) redirect('/login?callbackUrl=%2Fmessages')
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <div className="my-5 flex flex-wrap items-center justify-between gap-3 border-b border-line-strong pb-4"><h1 className="type-display">Messages</h1><MessageRefresh /></div>
    {forumReplies.length > 0 && <section aria-label="Replies to your forum questions" className="mb-7 space-y-3">
      <h2 className="type-title">Replies to your questions</h2>
      {forumReplies.map(reply => {
        const body = <><p className="text-xs font-semibold text-link">Your forum question</p><p className="mt-1 line-clamp-2 text-sm text-muted">{reply.question.content}</p><p className="mt-3 text-sm font-semibold text-ink">{reply.author.name} replied{reply.notification && !reply.notification.readAt && <span className="ml-2 inline-block size-2 rounded-full bg-link" aria-label="Unread" />}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{reply.content}</p><span className="mt-3 block text-sm font-medium text-link">Open discussion →</span></>
        return <article key={reply.id} className="rounded-xl border border-line bg-cream shadow-sm">{reply.notification ? <form action={openNotification}><input type="hidden" name="id" value={reply.notification.id} /><button className="block w-full p-4 text-left">{body}</button></form> : <Link className="block p-4" href={`/explore/questions/${reply.question.id}`}>{body}</Link>}</article>
      })}
    </section>}
    {forumReplies.length > 0 && <h2 className="type-title mb-3">Private conversations</h2>}
    {result.threads.length === 0 && forumReplies.length === 0 && <p className="rounded-xl border border-sand bg-cream p-6 text-sm leading-relaxed text-brown">No messages yet. Open a traveler’s profile or a place on their trip to start a conversation.</p>}
    {/* Conversations with messages you haven't opened stand out: a blue edge, bold preview and a "new" count. */}
    <div className="space-y-3">{result.threads.map(thread => <Link key={JSON.stringify([thread.person.id, thread.itineraryId])} href={messageThreadHref(thread.person.id, thread.itineraryId)} className={`block rounded-xl border p-4 shadow-sm hover:border-link transition-colors ${thread.unread ? 'border-link border-l-4 bg-card' : 'border-line bg-cream'}`}>
      <div className="flex items-start justify-between gap-3"><h2 className="type-title">{thread.person.name}</h2>{thread.unread > 0 && <span className="shrink-0 rounded-full bg-link px-2.5 py-0.5 text-xs font-semibold text-white">{thread.unread} new</span>}</div>
      <p className="text-sm font-semibold text-link mt-1">{thread.itineraryId ? thread.itineraryTitle || 'Trip conversation' : 'General conversation'}</p>
      {thread.placeName && <p className="text-xs text-link mt-1">📍 {thread.placeName}</p>}
      <p className={`line-clamp-2 break-words text-sm mt-1 ${thread.unread ? 'font-semibold text-ink' : 'text-brown'}`}>{thread.content}</p>
      <time className="text-xs text-brown" dateTime={thread.createdAt.toISOString()}>{thread.createdAt.toLocaleDateString('en-US')}</time>
    </Link>)}</div>
  </div>
}
