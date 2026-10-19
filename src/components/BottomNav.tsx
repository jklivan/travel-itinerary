'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bookmark, BriefcaseBusiness, Compass, Home, Plus } from 'lucide-react'
import useBottomToolbar from './useBottomToolbar'
import PostTripDialog from './PostTripDialog'

// Post · Feed · Explore | Plan · My Trips · Saved. Post (a trip you've taken, or one of your plans) and Plan (with
// Postcard's AI) are the two navy discs, one on each side of the divider. Messages live in the header.
export default function BottomNav({ userId }: { pendingCount: number; userId: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const toolbarRef = useBottomToolbar()
  const [posting, setPosting] = useState(false)

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
  const label = 'text-label font-medium uppercase tracking-widest'
  // Post and Plan: a navy disc, always filled.
  const disc = 'flex size-11 items-center justify-center rounded-full bg-ink text-white shadow-card'

  return (
    <div ref={toolbarRef} aria-label="Main navigation" className="app-bottom-nav fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-line-soft bg-cream shadow-nav">
      <div className="max-w-2xl mx-auto grid grid-cols-6 items-center py-2">
        <button type="button" onClick={() => userId ? setPosting(true) : router.push('/login')} aria-haspopup="dialog" className={cls(false)}>
          <span className={disc}><Plus size={22} /></span>
          <span className={`${label} text-ink`}>Post</span>
        </button>

        <Link href="/" aria-current={isFeed ? 'page' : undefined} className={cls(isFeed)}>
          <span className={iconClass(isFeed)}><Home size={22} /></span>
          <span className={label}>Feed</span>
        </Link>

        <Link href="/explore" aria-current={isExplore ? 'page' : undefined} className={cls(isExplore)}>
          <span className={iconClass(isExplore)}><Compass size={22} /></span>
          <span className={label}>Explore</span>
        </Link>

        {/* Plan: the Postcard compass star, after a divider from the browsing tabs. */}
        <Link href={userId ? '/testplan' : '/login'} aria-current={isPlanner ? 'page' : undefined} className={`${cls(isPlanner)} relative before:absolute before:inset-y-2 before:left-0 before:w-px before:bg-line`}>
          <span className={disc}><CompassStar /></span>
          <span className={`${label} text-ink`}>Plan</span>
        </Link>

        <Link href={userId ? '/trips' : '/login'} aria-current={isTrips ? 'page' : undefined} className={cls(isTrips)}>
          <span className={iconClass(isTrips)}><BriefcaseBusiness size={22} /></span>
          <span className={label}>My Trips</span>
        </Link>

        <Link href={userId ? '/saved' : '/login'} aria-current={isSaved ? 'page' : undefined} className={cls(isSaved)}>
          <span className={iconClass(isSaved)}><Bookmark size={22} /></span>
          <span className={label}>Saved</span>
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
