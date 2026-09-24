'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bookmark, Compass, Home, NotebookPen } from 'lucide-react'
import useBottomToolbar from './useBottomToolbar'
import PostTripDialog from './PostTripDialog'

// Feed · Explore · Post · My Trips · Saved. Messages lives in the header.
export default function BottomNav({ userId }: { pendingCount: number; userId: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const toolbarRef = useBottomToolbar()
  const [posting, setPosting] = useState(false)

  const isFeed = pathname === '/'
  const isExplore = pathname.startsWith('/explore')
  const isTrips = pathname === '/trips'
  const isSaved = pathname === '/saved'

  function cls(active: boolean) {
    return `flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 transition-colors ${active ? 'text-[#242e25]' : 'text-[#8B6F4E] hover:text-[#485340]'}`
  }
  function iconClass(active: boolean) {
    return active ? 'flex size-8 items-center justify-center rounded-full bg-[#242e25] text-[#faf7f1]' : 'flex size-8 items-center justify-center'
  }
  const label = 'text-[10px] font-medium uppercase tracking-[0.12em]'

  return (
    <div ref={toolbarRef} aria-label="Main navigation" className="app-bottom-nav fixed bottom-0 left-0 right-0 bg-[#faf7f1] border-t border-[#dfd3c2] shadow-lg z-50">
      <div className="max-w-2xl mx-auto grid grid-cols-5 items-center py-2">
        <Link href="/" aria-current={isFeed ? 'page' : undefined} className={cls(isFeed)}>
          <span className={iconClass(isFeed)}><Home className="w-6 h-6" /></span>
          <span className={label}>Feed</span>
        </Link>

        <Link href="/explore" aria-current={isExplore ? 'page' : undefined} className={cls(isExplore)}>
          <span className={iconClass(isExplore)}><Compass className="w-5 h-5" /></span>
          <span className={label}>Explore</span>
        </Link>

        <button type="button" aria-haspopup="dialog" onClick={() => userId ? setPosting(true) : router.push('/login')} className={cls(posting)}>
          <span className={iconClass(false)}><Image src="/brand/postcard-icon.svg" alt="" width={24} height={24} /></span>
          <span className={label}>Post</span>
        </button>

        <Link href={userId ? '/trips' : '/login'} aria-current={isTrips ? 'page' : undefined} className={cls(isTrips)}>
          <span className={iconClass(isTrips)}><NotebookPen className="w-5 h-5" /></span>
          <span className={label}>My Trips</span>
        </Link>

        <Link href={userId ? '/saved' : '/login'} aria-current={isSaved ? 'page' : undefined} className={cls(isSaved)}>
          <span className={iconClass(isSaved)}><Bookmark className="w-5 h-5" /></span>
          <span className={label}>Saved</span>
        </Link>
      </div>
      {posting && <PostTripDialog onClose={() => setPosting(false)} />}
    </div>
  )
}
