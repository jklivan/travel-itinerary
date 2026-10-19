'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUp, ChevronRight, Sparkles } from 'lucide-react'
import PostcardLogo from '@/components/PostcardLogo'
import type { TravelPreferences } from '@/lib/travelPreferences'

// Nothing extra is loaded for the start page; kept as a type so the page can say it's showing it.
export type Landing = Record<string, never>

// Plan with Postcard's start page (the bottom bar's Plan button): ask where to go, or reopen a past chat. Who's going,
// budget and the kind of trip aren't asked here: the planner asks a new traveler for them in the chat.
export default function PlanLanding({ history, busy, onSend }: { landing: Landing; history: { id: string; topic: string }[]; busy: boolean; onSend: (text: string, preferences?: TravelPreferences) => void }) {
  const [text, setText] = useState('')
  const [allChats, setAllChats] = useState(false)
  function submit() {
    const message = text.trim()
    if (message && !busy) onSend(message)
  }
  const chats = allChats ? history : history.slice(0, 3)

  return <div className="mx-auto max-w-2xl px-4 py-7 text-ink">
    <header className="relative mb-5 px-1">
      <h1 className="type-display max-w-sm pr-20 sm:pr-8">Plan with Postcard</h1>
      <PostcardLogo size={84} className="absolute -top-1 right-0 rotate-[8deg]" />
      <p className="mt-2 max-w-sm text-sm text-muted">Ideas, itineraries, hotels and restaurants, based on what you and your friends love.</p>
    </header>

    <form className="panel flex items-center gap-3 p-3" onSubmit={event => { event.preventDefault(); submit() }}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Sparkles size={18} /></span>
      <label className="min-w-0 flex-1"><span className="sr-only">Where do you want to go?</span>
        <input value={text} onChange={event => setText(event.target.value)} maxLength={4000} placeholder="Where do you want to go?" className="field" /></label>
      <button type="submit" disabled={busy || !text.trim()} aria-label="Ask Postcard" className="btn btn-primary w-11 shrink-0 !px-0"><ArrowUp size={18} /></button>
    </form>
    <p className="mt-2 px-1 text-xs text-muted">Try “A long weekend in Italy with kids”</p>

    {history.length > 0 && <section className="mt-8" aria-labelledby="chats-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="chats-heading" className="type-title">Past chats</h2>
        {history.length > 3 && <button type="button" onClick={() => setAllChats(open => !open)} className="inline-flex shrink-0 items-center text-sm text-link">{allChats ? 'Show fewer' : 'See all'}<ChevronRight size={16} /></button>}</div>
      <div className="space-y-2">{chats.map(chat => <Link key={chat.id} href={`/testplan?chat=${chat.id}`} className="panel flex items-center gap-3 px-4 py-3 text-sm text-ink transition-colors hover:bg-cream">
        <span className="min-w-0 flex-1 truncate">{chat.topic}</span><ChevronRight size={18} className="shrink-0 text-link" /></Link>)}</div>
    </section>}

    <p className="mt-8 text-center text-sm"><Link href="/plan" className="text-link underline">Start a plan without AI</Link></p>
  </div>
}
