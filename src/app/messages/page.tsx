import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMessageInbox } from '@/actions/messages'
import MessageRefresh from '@/components/MessageRefresh'

export default async function InboxPage() {
  const result = await getMessageInbox()
  if (!result.threads) redirect('/login?callbackUrl=%2Fmessages')
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <div className="my-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#C4A882] pb-4"><h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">Messages</h1><MessageRefresh /></div>
    {result.threads.length === 0 && <p className="rounded-xl border border-[#E8D5B7] bg-[#FAF7F2] p-6 text-sm leading-relaxed text-[#8B6F4E]">No messages yet. Open a traveler’s profile or a place on their trip to start a conversation.</p>}
    <div className="space-y-3">{result.threads.map(thread => <Link key={thread.person.id} href={`/messages/${thread.person.id}`} className="block rounded-xl border border-[#d7cebc] bg-[#FAF7F2] p-4 shadow-sm hover:border-[#507c76] transition-colors">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg text-[#2e4147]">{thread.person.name}</h2>
      {thread.placeName && <p className="text-xs text-[#507c76] mt-1">📍 {thread.placeName}</p>}
      <p className="line-clamp-2 break-words text-sm text-[#8B6F4E] mt-1">{thread.content}</p>
      <time className="text-xs text-[#8B6F4E]" dateTime={thread.createdAt.toISOString()}>{thread.createdAt.toLocaleDateString('en-US')}</time>
    </Link>)}</div>
  </div>
}
