'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BriefcaseBusiness, Compass, Home, Plus } from 'lucide-react'
import useBottomToolbar from './useBottomToolbar'
import PostTripDialog from './PostTripDialog'
import { NAV_TOUR, NAV_TOUR_KEY, type NavTourStep } from '@/lib/navTour'

const TOUR_TIPS: Record<NavTourStep, string> = { feed: 'See where your friends have been', plan: 'Plan your trip with AI', post: 'Post a trip you’ve taken' }

// Feed · Explore · Post · Plan · My Trips, all alike: Post (a trip you've taken, or one of your plans) opens the post
// sheet, Plan is Postcard's AI planner. Messages live in the header; Saved is reached from Plan with AI and Profile.
export default function BottomNav({ userId }: { pendingCount: number; userId: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const toolbarRef = useBottomToolbar()
  const [posting, setPosting] = useState(false)
  // The first-run tour (lib/navTour): which tab is highlighted, if any.
  const [tour, setTour] = useState<NavTourStep | null>(null)
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(NAV_TOUR_KEY) } catch { /* storage unavailable */ }
    if (NAV_TOUR.includes(saved as NavTourStep)) queueMicrotask(() => setTour(saved as NavTourStep))
  }, [pathname])
  // Tapping the highlighted tab (or × on its tip) moves on to the next one; after Post the tour is done.
  function nextStep(from: NavTourStep, skip = false) {
    if (tour !== from) return
    const next = skip ? null : NAV_TOUR[NAV_TOUR.indexOf(from) + 1] ?? null
    setTour(next)
    try { localStorage.setItem(NAV_TOUR_KEY, next ?? 'done') } catch { /* storage unavailable */ }
  }
  const tip = (step: NavTourStep) => userId && tour === step && <span role="status" className={`absolute bottom-full z-10 mb-2 flex w-40 items-start gap-1 rounded-2xl bg-mist px-3 py-2 text-left text-xs font-medium normal-case leading-snug tracking-normal text-link shadow-card after:absolute after:top-full after:-translate-x-1/2 after:border-x-[7px] after:border-t-[7px] after:border-x-transparent after:border-t-mist ${step === 'feed' ? 'left-1 after:left-8' : 'left-1/2 -translate-x-1/2 after:left-1/2'}`}>
    <span className="flex-1">{TOUR_TIPS[step]}</span>
    <span role="button" tabIndex={0} aria-label="Skip the tour" onClick={event => { event.preventDefault(); event.stopPropagation(); nextStep(step, true) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); nextStep(step, true) } }} className="-mr-1 -mt-0.5 px-1 text-sm text-muted">×</span>
  </span>
  const glow = (step: NavTourStep) => userId && tour === step ? 'rounded-full bg-mist ring-2 ring-link motion-safe:animate-pulse' : ''

  const isFeed = pathname === '/'
  const isExplore = pathname.startsWith('/explore')
  const isTrips = pathname === '/trips'
  // Starting a trip (/plan) and the AI planner it links to both count as Plan.
  const isPlanner = pathname === '/plan' || pathname === '/testplan'

  function cls(active: boolean) {
    return `flex min-w-0 flex-col items-center gap-0.5 px-1 py-1 transition-colors ${active ? 'text-ink' : 'text-brown hover:text-ink'}`
  }
  // Every icon sits in the same square, so the labels line up (each whole item is the tap target). The current tab is just darker.
  function iconClass(active: boolean) {
    return `flex size-8 items-center justify-center ${active ? 'text-ink' : ''}`
  }
  const label = 'text-label font-medium uppercase tracking-widest'

  return (
    <div ref={toolbarRef} aria-label="Main navigation" className="app-bottom-nav fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-line-soft bg-cream shadow-nav">
      <div className="max-w-2xl mx-auto grid grid-cols-5 items-center py-1">
        <Link href="/" onClick={() => nextStep('feed')} aria-current={isFeed ? 'page' : undefined} className={`relative ${cls(isFeed)}`}>
          {tip('feed')}
          <span className={`${iconClass(isFeed)} ${glow('feed')}`}><Home size={22} /></span>
          <span className={label}>Feed</span>
        </Link>

        <Link href="/explore" aria-current={isExplore ? 'page' : undefined} className={cls(isExplore)}>
          <span className={iconClass(isExplore)}><Compass size={22} /></span>
          <span className={label}>Explore</span>
        </Link>

        <button type="button" onClick={() => { nextStep('post'); if (userId) setPosting(true); else router.push('/login') }} aria-haspopup="dialog" className={`relative ${cls(false)}`}>
          {tip('post')}
          <span className={`${iconClass(false)} ${glow('post')}`}><Plus size={22} /></span>
          <span className={label}>Post</span>
        </button>

        {/* Plan: the Postcard compass star. */}
        <Link href={userId ? '/testplan' : '/login'} onClick={() => nextStep('plan')} aria-current={isPlanner ? 'page' : undefined} className={`relative ${cls(isPlanner)}`}>
          {tip('plan')}
          <span className={`${iconClass(isPlanner)} ${glow('plan')}`}><CompassStar /></span>
          <span className={label}>Plan</span>
        </Link>

        <Link href={userId ? '/trips' : '/login'} aria-current={isTrips ? 'page' : undefined} className={cls(isTrips)}>
          <span className={iconClass(isTrips)}><BriefcaseBusiness size={22} /></span>
          <span className={label}>My Trips</span>
        </Link>
      </div>
      {posting && <PostTripDialog onClose={() => setPosting(false)} />}
    </div>
  )
}

// The eight-point star from the Postcard stamp.
function CompassStar() {
  return <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" fill="currentColor">
    <path d="M16 1 18.6 13.4 31 16 18.6 18.6 16 31 13.4 18.6 1 16 13.4 13.4Z" />
    <path d="M16 7 17.4 14.6 25 16 17.4 17.4 16 25 14.6 17.4 7 16 14.6 14.6Z" transform="rotate(45 16 16)" opacity=".7" />
  </svg>
}
