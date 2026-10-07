import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewPlanForm from './NewPlanForm'
import { ChevronRight, Sparkles } from 'lucide-react'
import PostcardLogo from '@/components/PostcardLogo'

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ savePlace?: string; saveStory?: string; from?: string }> }) {
  const { savePlace, saveStory, from } = await searchParams
  // Post → New trip from scratch lands here too: the same new-trip step and planner, minus Plan with AI.
  const posting = from === 'post'
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fplan')
  return <div className="mx-auto max-w-2xl px-4 py-7 text-ink">
    <section aria-labelledby="start-planning-heading" className="bg-transparent">
      <header className="relative mb-5 px-1">
        <h1 id="start-planning-heading" className="type-display max-w-sm pr-20 sm:pr-8">Your next trip starts here</h1>
        <PostcardLogo size={84} className="absolute -top-1 right-0 rotate-[8deg]" />
        <p className="mt-2 text-sm text-muted">{posting ? 'Add your places, then post it when you’re ready.' : 'Collect places now. Add details later.'}</p>
      </header>
      {!posting && <Link href="/testplan" className="panel-hint group mb-5 flex items-center gap-3 p-4 text-ink transition-colors hover:bg-mist-strong">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Sparkles size={18} /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">Plan with AI</span><span className="block text-sm text-link">Ask where to go, using what you and your friends loved.</span></span>
        <ChevronRight size={18} className="shrink-0 text-link transition-transform group-hover:translate-x-0.5" />
      </Link>}
      <NewPlanForm saveStory={typeof saveStory === 'string' && saveStory.length <= 200 ? saveStory : undefined} savePlace={typeof savePlace === 'string' && savePlace.length <= 200 ? savePlace : undefined} />
    </section>
  </div>
}
