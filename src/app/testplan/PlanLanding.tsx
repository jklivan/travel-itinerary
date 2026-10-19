'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUp, Bookmark, ChevronRight, Sparkles } from 'lucide-react'
import Image from 'next/image'
import PostcardLogo from '@/components/PostcardLogo'
import type { TravelPreferences } from '@/lib/travelPreferences'

// What the start page loads besides the past chats: how many trips are in Saved (its row under the chats).
export type Landing = { savedCount: number }

// Plan with Postcard's start page (the bottom bar's Plan button): ask where to go, or reopen a past chat. Who's going,
// budget and the kind of trip aren't asked here: the planner asks a new traveler for them in the chat.
export default function PlanLanding({ landing, history, busy, onSend }: { landing: Landing; history: { id: string; topic: string }[]; busy: boolean; onSend: (text: string, preferences?: TravelPreferences) => void }) {
  const [text, setText] = useState('')
  const [allChats, setAllChats] = useState(false)
  function submit() {
    const message = text.trim()
    if (message && !busy) onSend(message)
  }
  const chats = allChats ? history : history.slice(0, 3)

  return <div className="mx-auto max-w-2xl px-4 pb-7 text-ink">
    {/* A coastline behind the title (fading into the page under the text and at the bottom), and a postcard of it
        with the Postcard stamp. Edge to edge on phones; the question box overlaps its foot. */}
    <header className="relative -mx-4 h-[370px] overflow-hidden sm:mx-0 sm:mt-6 sm:h-[380px] sm:rounded-2xl">
      {/* Full colour (the photo file itself is colour-graded: blue sky, turquoise sea), with no wash over it. It still fades out at the
          bottom (a mask, not a cover), so no edge shows where it ends. */}
      <Image src="/brand/plan-hero-capri.jpg" alt="" fill priority sizes="(min-width: 672px) 672px, 100vw" className="object-cover [mask-image:linear-gradient(to_bottom,black_55%,transparent_96%)]" />
      <div className="relative z-10 max-w-[68%] px-4 pt-7 sm:max-w-[52%] sm:px-8">
        <h1 className="type-display">Plan with Postcard</h1>
        {/* A faint halo keeps the small text readable where it crosses the rocks, without dimming the photo. */}
        <p className="mt-3 text-sm font-medium text-ink [text-shadow:0_0_6px_var(--color-paper),0_0_2px_var(--color-paper)]">Ideas, itineraries, hotels and restaurants, based on what you and your friends love.</p>
      </div>
      {/* A postcard, not a polaroid: landscape, an even white border, the stamp in its corner. */}
      <div aria-hidden="true" className="absolute right-3 top-[176px] w-[46%] max-w-[260px] sm:right-10 sm:top-12 sm:w-[38%] rotate-[4deg] bg-card p-1.5 shadow-pop">
        <div className="relative aspect-[3/2] overflow-hidden">
          <Image src="/brand/plan-postcard-capri.jpg" alt="" fill sizes="260px" className="object-cover object-[50%_45%]" />
          <PostcardLogo size={40} className="absolute right-1.5 top-1.5 size-9 rotate-[-4deg] opacity-90 sm:size-10" />
        </div>
      </div>
    </header>

    <form className="panel relative z-10 -mt-16 flex items-center gap-3 p-3 shadow-card" onSubmit={event => { event.preventDefault(); submit() }}>
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

    {/* Saved (no longer in the bottom bar): trips saved from others, for ideas while planning. */}
    <section className="mt-8" aria-labelledby="saved-heading">
      <h2 id="saved-heading" className="type-title mb-3">Saved</h2>
      <Link href="/saved" className="panel flex items-center gap-3 p-4 text-ink transition-colors hover:bg-cream">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-link/10 text-link"><Bookmark size={18} /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">Saved trips</span><span className="block text-sm text-muted">{landing.savedCount ? `${landing.savedCount} ${landing.savedCount === 1 ? 'trip' : 'trips'} saved, in your folders` : 'Trips you save from friends show up here.'}</span></span>
        <ChevronRight size={18} className="shrink-0 text-link" />
      </Link>
    </section>

    <p className="mt-8 text-center text-sm"><Link href="/plan" className="text-link underline">Start a plan without AI</Link></p>
  </div>
}
