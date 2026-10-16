import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMessageInbox } from '@/actions/messages'
import { getForumReplyInbox } from '@/actions/questions'
import { openNotification } from '@/actions/notifications'
import MessageRefresh from '@/components/MessageRefresh'
import MessageInbox, { type InboxPerson } from '@/components/MessageInbox'
import NewMessage, { FriendPicker } from '@/components/NewMessage'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hiddenUserIds } from '@/lib/blocks'

export default async function InboxPage() {
  const [result, forumReplies, session] = await Promise.all([getMessageInbox(), getForumReplyInbox(), auth()])
  if (!result.threads || !session?.user?.id) redirect('/login?callbackUrl=%2Fmessages')
  // Friends to start a conversation with: people you follow and people who follow you (not blocked or hidden).
  const userId = session.user.id
  const hidden = await hiddenUserIds(userId)
  const person = { select: { id: true, name: true, image: true } }
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId, status: 'accepted', followingId: { notIn: hidden } }, select: { following: person } }),
    prisma.follow.findMany({ where: { followingId: userId, status: 'accepted', followerId: { notIn: hidden } }, select: { follower: person } }),
  ])
  const friends = [...new Map([...following.map(f => f.following), ...followers.map(f => f.follower)].map(friend => [friend.id, friend])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
  // One section per person, ordered by their latest message; their conversations (newest first) underneath.
  const people = result.threads.reduce<InboxPerson[]>((groups, thread) => {
    const conversation = { itineraryId: thread.itineraryId, title: thread.itineraryId ? thread.itineraryTitle || 'Trip conversation' : 'General conversation', placeName: thread.placeName, content: thread.content, createdAt: thread.createdAt.toISOString(), unread: thread.unread }
    const group = groups.find(g => g.person.id === thread.person.id)
    if (group) group.threads.push(conversation)
    else groups.push({ person: thread.person, threads: [conversation] })
    return groups
  }, [])
  return <div className="max-w-2xl mx-auto px-4 py-6">
    <div className="my-5 flex flex-wrap items-center justify-between gap-3 border-b border-line-strong pb-4"><h1 className="type-display">Messages</h1><MessageRefresh />{(result.threads.length > 0 || forumReplies.length > 0) && friends.length > 0 && <NewMessage friends={friends} />}</div>
    {forumReplies.length > 0 && <section aria-label="Replies to your forum questions" className="mb-7 space-y-3">
      <h2 className="type-title">Replies to your questions</h2>
      {forumReplies.map(reply => {
        const body = <><p className="text-xs font-semibold text-link">Your forum question</p><p className="mt-1 line-clamp-2 text-sm text-muted">{reply.question.content}</p><p className="mt-3 text-sm font-semibold text-ink">{reply.author.name} replied{reply.notification && !reply.notification.readAt && <span className="ml-2 inline-block size-2 rounded-full bg-link" aria-label="Unread" />}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{reply.content}</p><span className="mt-3 block text-sm font-medium text-link">Open discussion →</span></>
        return <article key={reply.id} className="panel">{reply.notification ? <form action={openNotification}><input type="hidden" name="id" value={reply.notification.id} /><button className="block w-full p-4 text-left">{body}</button></form> : <Link className="block p-4" href={`/explore/questions/${reply.question.id}`}>{body}</Link>}</article>
      })}
    </section>}
    {forumReplies.length > 0 && <h2 className="type-title mb-3">Private conversations</h2>}
    {result.threads.length === 0 && forumReplies.length === 0 && <section className="panel p-5" aria-labelledby="start-heading">
      <h2 id="start-heading" className="type-label text-ink">Message a friend</h2>
      <p className="mt-1 mb-3 text-sm text-muted">No messages yet. Tap a friend to start a conversation.</p>
      <FriendPicker friends={friends} />
    </section>}
    <MessageInbox people={people} />
  </div>
}
