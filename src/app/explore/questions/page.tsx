
import BackButton from '@/components/BackButton'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getFriendQuestions } from '@/actions/questions'
import QuestionComposer from '@/components/QuestionComposer'
import MessageRefresh from '@/components/MessageRefresh'

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=%2Fexplore%2Fquestions')
  const { before } = await searchParams
  const userId = session.user.id
  const result = await getFriendQuestions(before)
  if (!result.questions) notFound()
  return <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
    <BackButton fallback="/explore" className="text-sm text-[#8B6F4E]">← Back</BackButton>
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="font-[family-name:var(--font-playfair)] text-3xl text-[#242e25]">Ask your friends</h1><p className="mt-2 text-sm text-[#8B6F4E]">Trip questions, trusted advice, and ideas worth sharing.</p></div>
      <MessageRefresh label="Refresh questions" />
    </div>
    <QuestionComposer />
    <section aria-label="Questions from your circle" className="space-y-3">
      <h2 className="font-[family-name:var(--font-playfair)] text-xl text-[#242e25]">Questions from your circle</h2>
      {before && <Link href="/explore/questions" className="inline-block text-sm text-[#59694f] underline">Latest questions</Link>}
      {result.questions.length === 0 && <div className="rounded-xl border border-[#d7cebc] bg-[#faf7f1] p-5 text-sm leading-relaxed text-[#8B6F4E]">No questions yet. Ask the first one above. Questions from people who follow you will appear here too. <Link href="/friends" className="text-[#59694f] underline">Find friends</Link></div>}
      {result.questions.map(question => <Link key={question.id} href={`/explore/questions/${question.id}`} className="block rounded-xl border border-[#d7cebc] bg-[#faf7f1] p-5 shadow-sm hover:border-[#59694f]">
        <p className="text-xs font-semibold text-[#59694f]">{question.authorId === userId ? 'You' : question.author.name} asked</p>
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-base text-[#2e4147]">{question.content}</p>
        {question.itineraryTitle && <p className="mt-3 text-sm text-[#59694f]">About: {question.itineraryTitle}</p>}
        <div className="mt-4 flex justify-between gap-3 text-xs text-[#8B6F4E]"><span>{question._count.replies} {question._count.replies === 1 ? 'reply' : 'replies'}</span><time dateTime={question.createdAt.toISOString()}>{question.createdAt.toLocaleDateString('en-US', { timeZone: 'UTC' })}</time></div>
      </Link>)}
      {result.hasMore && <Link href={`/explore/questions?before=${result.questions.at(-1)!.id}`} className="inline-block text-sm text-[#59694f] underline">Earlier questions</Link>}
    </section>
  </div>
}
