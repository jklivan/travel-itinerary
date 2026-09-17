
import BackButton from '@/components/BackButton'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getFriendQuestion } from '@/actions/questions'
import QuestionComposer from '@/components/QuestionComposer'
import MessageAttachment from '@/components/MessageAttachment'
import MessageRefresh from '@/components/MessageRefresh'

export default async function QuestionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ before?: string }> }) {
  const { id } = await params
  const { before } = await searchParams
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/explore/questions/${id}`)}`)
  const userId = session.user.id
  const result = await getFriendQuestion(id, before)
  if (!result.question) notFound()
  const { question, replies } = result
  return <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
    <BackButton fallback="/explore/questions" className="text-sm text-[#8B6F4E]">← Back</BackButton>
    <div className="flex items-center justify-between gap-3"><h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810]">{question.authorId === userId ? 'Your question' : `${question.author.name} asked`}</h1><MessageRefresh label="Refresh replies" /></div>
    <article className="space-y-4 rounded-2xl border border-[#C4A882] bg-[#FAF7F2] p-5">
      <p className="whitespace-pre-wrap break-words text-lg leading-relaxed text-[#2e4147]">{question.content}</p>
      {question.itineraryTitle && <MessageAttachment kind="trip" name={question.itineraryTitle} href={question.itineraryId ? `/itinerary/${question.itineraryId}` : undefined} />}
      <p className="text-xs text-[#8B6F4E]">Visible to {question.authorId === userId ? 'you and the people you follow' : `${question.author.name} and the people they follow`}.</p>
    </article>
    <section aria-label="Replies" className="space-y-3">
      <h2 className="font-[family-name:var(--font-playfair)] text-xl text-[#2C1810]">Replies</h2>
      {result.hasOlder && <Link className="inline-block text-sm text-[#507c76] underline" href={`/explore/questions/${id}?before=${replies[0].id}`}>Earlier replies</Link>}
      {before && <Link className="block text-sm text-[#507c76] underline" href={`/explore/questions/${id}`}>Latest replies</Link>}
      {replies.length === 0 && <p className="text-sm text-[#8B6F4E]">No replies yet. Share an idea to get the conversation started.</p>}
      {replies.map(reply => <article key={reply.id} id={`reply-${reply.id}`} className="space-y-3 rounded-xl border border-[#d7cebc] bg-[#fffdf6] p-4">
        <Link href={`/user/${reply.authorId}`} className="text-sm font-semibold text-[#507c76]">{reply.authorId === userId ? 'You' : reply.author.name}</Link>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#2e4147]">{reply.content}</p>
        {reply.itineraryTitle && <MessageAttachment kind="trip" name={reply.itineraryTitle} href={reply.itineraryId ? `/itinerary/${reply.itineraryId}` : undefined} />}
        <time className="block text-xs text-[#8B6F4E]" dateTime={reply.createdAt.toISOString()}>{reply.createdAt.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</time>
      </article>)}
    </section>
    <QuestionComposer key={id} questionId={id} />
  </div>
}
