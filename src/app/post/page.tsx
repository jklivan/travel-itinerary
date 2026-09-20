import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import NewPlanForm from '@/app/plan/NewPlanForm'

export default async function PostPage() {
  const userId = (await auth())?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fpost')

  return <div className="mx-auto max-w-2xl px-4 py-7 text-[#2e4147]">
    <section aria-labelledby="post-heading" className="rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4 sm:p-5">
      <header className="mb-4">
        <h1 id="post-heading" className="font-[family-name:var(--font-playfair)] text-2xl tracking-wide text-[#242e25]">Post your trip</h1>
        <p className="mt-1 text-sm text-[#73786d]">Build a full itinerary with photos, ratings, recommendations, and tags, then share it when you’re ready.</p>
      </header>
      <NewPlanForm mode="post" />
    </section>
  </div>
}
