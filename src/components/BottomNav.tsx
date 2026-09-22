'use client'

import Link from 'next/link'
import useBottomToolbar from './useBottomToolbar'
import { usePathname } from 'next/navigation'
import { Home, Compass, Plus, Map, MessageCircle } from 'lucide-react'
import useNotificationCounts from './useNotificationCounts'
import { Suspense } from 'react'

function BottomNavInner({ pendingCount, userId }: { pendingCount: number; userId: string | null }) {
  const pathname = usePathname()
  const { unreadMessages } = useNotificationCounts()
  const toolbarRef = useBottomToolbar()

  const isFeed = pathname === '/'
  const isExplore = pathname.startsWith('/explore')
  const profileHref = userId ? `/user/${userId}` : '/login'
  const isProfile = !!userId && pathname === profileHref
  const isMessages = pathname === '/messages' || pathname.startsWith('/messages/')

  function cls(active: boolean) {
    return `flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 transition-colors ${active ? 'text-[#242e25]' : 'text-[#8B6F4E] hover:text-[#485340]'}`
  }

  function iconClass(active: boolean) {
    return active ? 'flex size-8 items-center justify-center rounded-full bg-[#242e25] text-[#faf7f1]' : 'flex size-8 items-center justify-center'
  }

  return (
    <div ref={toolbarRef} aria-label="Main navigation" className="app-bottom-nav fixed bottom-0 left-0 right-0 bg-[#faf7f1] border-t border-[#dfd3c2] shadow-lg z-50">
      <div className="max-w-2xl mx-auto grid grid-cols-5 items-center py-2">
        <Link href="/" className={cls(isFeed)}>
          <span className={iconClass(false)}><Home className="w-6 h-6" /></span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em]">Feed</span>
        </Link>

        <Link href="/explore" className={cls(isExplore)}>
          <span className={iconClass(isExplore)}><Compass className="w-5 h-5" /></span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em]">Explore</span>
        </Link>

        <Link href="/plan" aria-label="Start planning" className="flex min-w-0 flex-col items-center gap-1 text-[#242e25]">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#242e25] text-white shadow-lg"><Plus className="h-7 w-7" /></span>
          <span className="text-center text-[10px] uppercase leading-tight font-semibold tracking-[0.12em] min-[393px]:text-xs">Start planning</span>
        </Link>

        <Link href={profileHref} aria-current={isProfile ? 'page' : undefined} aria-label={`My trips${pendingCount ? `, ${pendingCount} pending friend requests` : ''}`} className={`relative ${cls(isProfile)}`}>
          <span className={iconClass(false)}><Map className="w-6 h-6" /></span>
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
          <span className="text-[10px] min-[375px]:text-xs font-medium uppercase tracking-[0.12em]">My trips</span>
        </Link>

        <Link href="/messages" aria-current={isMessages ? 'page' : undefined} aria-label={`Messages${unreadMessages ? `, ${unreadMessages} unread` : ''}`} className={`relative ${cls(isMessages)}`}>
          <span className={iconClass(false)}><MessageCircle className="w-6 h-6" /></span>
          {unreadMessages > 0 && <span className="absolute top-1 right-1 min-w-4 rounded-full bg-[#59694f] px-1 text-center text-[10px] font-bold text-white">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
          <span className="text-[10px] min-[375px]:text-xs font-medium uppercase tracking-[0.12em]">Messages</span>
        </Link>

      </div>
    </div>
  )
}

export default function BottomNav({ pendingCount, userId }: { pendingCount: number; userId: string | null }) {
  return (
    <Suspense fallback={null}>
      <BottomNavInner pendingCount={pendingCount} userId={userId} />
    </Suspense>
  )
}
