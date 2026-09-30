'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, BriefcaseBusiness, Compass, Home } from 'lucide-react'
import useBottomToolbar from './useBottomToolbar'

// Feed · Explore · Plan · My Trips · Saved. Plan starts a new trip; Post (+) and Messages live in the header.
export default function BottomNav({ userId }: { pendingCount: number; userId: string | null }) {
  const pathname = usePathname()
  const toolbarRef = useBottomToolbar()

  const isFeed = pathname === '/'
  const isExplore = pathname.startsWith('/explore')
  const isTrips = pathname === '/trips'
  const isSaved = pathname === '/saved'
  // Starting a trip (/plan) and the AI planner it links to both count as Plan.
  const isPlanner = pathname === '/plan' || pathname === '/testplan'

  function cls(active: boolean) {
    return `flex min-w-0 flex-col items-center gap-1 px-1 py-2 transition-colors ${active ? 'text-ink' : 'text-brown hover:text-ink'}`
  }
  function iconClass(active: boolean) {
    return active ? 'flex size-9 items-center justify-center rounded-full bg-ink text-white' : 'flex size-9 items-center justify-center'
  }
  const label = 'text-[10px] font-medium uppercase tracking-[0.12em]'

  return (
    <div ref={toolbarRef} aria-label="Main navigation" className="app-bottom-nav fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-line-soft bg-cream shadow-[0_-4px_18px_rgba(31,51,84,0.08)]">
      <div className="max-w-2xl mx-auto grid grid-cols-5 items-center py-2">
        <Link href="/" aria-current={isFeed ? 'page' : undefined} className={cls(isFeed)}>
          <span className={iconClass(isFeed)}><Home className="w-6 h-6" /></span>
          <span className={label}>Feed</span>
        </Link>

        <Link href="/explore" aria-current={isExplore ? 'page' : undefined} className={cls(isExplore)}>
          <span className={iconClass(isExplore)}><Compass className="w-5 h-5" /></span>
          <span className={label}>Explore</span>
        </Link>

        {/* Plan sits raised in the middle: a navy disc with the Postcard compass star. */}
        <Link href={userId ? '/plan' : '/login'} aria-current={isPlanner ? 'page' : undefined} className={`${cls(isPlanner)} -mt-7`}>
          <span className="flex size-[62px] items-center justify-center rounded-full border-4 border-cream bg-ink text-white shadow-[0_4px_12px_rgba(31,51,84,0.3)]"><CompassStar /></span>
          <span className={label}>Plan</span>
        </Link>

        <Link href={userId ? '/trips' : '/login'} aria-current={isTrips ? 'page' : undefined} className={cls(isTrips)}>
          <span className={iconClass(isTrips)}><BriefcaseBusiness className="w-5 h-5" /></span>
          <span className={label}>My Trips</span>
        </Link>

        <Link href={userId ? '/saved' : '/login'} aria-current={isSaved ? 'page' : undefined} className={cls(isSaved)}>
          <span className={iconClass(isSaved)}><Bookmark className="w-5 h-5" /></span>
          <span className={label}>Saved</span>
        </Link>
      </div>
    </div>
  )
}

// The eight-point star from the Postcard stamp.
function CompassStar() {
  return <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="currentColor">
    <path d="M16 1 18.6 13.4 31 16 18.6 18.6 16 31 13.4 18.6 1 16 13.4 13.4Z" />
    <path d="M16 7 17.4 14.6 25 16 17.4 17.4 16 25 14.6 17.4 7 16 14.6 14.6Z" transform="rotate(45 16 16)" opacity=".7" />
  </svg>
}
