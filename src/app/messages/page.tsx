import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMessageInbox } from '@/actions/messages'
import { getForumReplyInbox } from '@/actions/questions'
import { openNotification } from '@/actions/notifications'
import MessageRefresh from '@/components/MessageRefresh'

export default async function InboxPage() {
  const [result, forumReplies] = await Promise.all([getMessageInbox(), getForumReplyInbox()])
  if (!result.threads) redirect('/login?callbackUrl=%2Fmessages')
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <div className="my-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#C4A882] pb-4"><h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">Messages</h1><MessageRefresh /></div>
    {forumReplies.length > 0 && <section aria-label="Replies to your forum questions" className="mb-7 space-y-3">
      <h2 className="font-[family-name:var(--font-playfair)] text-xl text-[#2e4147]">Replies to your questions</h2>
      {forumReplies.map(reply => {
        const body = <><p className="text-xs font-semibold text-[#507c76]">Your forum question</p><p className="mt-1 line-clamp-2 text-sm text-[#6b7067]">{reply.question.content}</p><p className="mt-3 text-sm font-semibold text-[#2e4147]">{reply.author.name} replied{reply.notification && !reply.notification.readAt && <span className="ml-2 inline-block size-2 rounded-full bg-[#507c76]" aria-label="Unread" />}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#2e4147]">{reply.content}</p><span className="mt-3 block text-sm font-medium text-[#507c76]">Open discussion →</span></>
        return <article key={reply.id} className="rounded-xl border border-[#d7cebc] bg-[#FAF7F2] shadow-sm">{reply.notification ? <form action={openNotification}><input type="hidden" name="id" value={reply.notification.id} /><button className="block w-full p-4 text-left">{body}</button></form> : <Link className="block p-4" href={`/explore/questions/${reply.question.id}`}>{body}</Link>}</article>
      })}
    </section>}
    {forumReplies.length > 0 && <h2 className="mb-3 font-[family-name:var(--font-playfair)] text-xl text-[#2e4147]">Private conversations</h2>}
    {result.threads.length === 0 && forumReplies.length === 0 && <p className="rounded-xl border border-[#E8D5B7] bg-[#FAF7F2] p-6 text-sm leading-relaxed text-[#8B6F4E]">No messages yet. Open a traveler’s profile or a place on their trip to start a conversation.</p>}
    <div className="space-y-3">{result.threads.map(thread => <Link key={thread.person.id} href={`/messages/${thread.person.id}`} className="block rounded-xl border border-[#d7cebc] bg-[#FAF7F2] p-4 shadow-sm hover:border-[#507c76] transition-colors">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg text-[#2e4147]">{thread.person.name}</h2>
      {(thread.placeName || thread.itineraryTitle) && <p className="text-xs text-[#507c76] mt-1">📍 {thread.placeName || thread.itineraryTitle}</p>}
      <p className="line-clamp-2 break-words text-sm text-[#8B6F4E] mt-1">{thread.content}</p>
      <time className="text-xs text-[#8B6F4E]" dateTime={thread.createdAt.toISOString()}>{thread.createdAt.toLocaleDateString('en-US')}</time>
    </Link>)}</div>
  </div>
}
