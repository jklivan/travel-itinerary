'use client'

import Link from 'next/link'
import Image from 'next/image'
import useBottomToolbar from './useBottomToolbar'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, Compass, Map, MessageCircle } from 'lucide-react'
import useNotificationCounts from './useNotificationCounts'
import { Suspense } from 'react'

function BottomNavInner({ userId }: { userId: string | null }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { unreadMessages } = useNotificationCounts()
  const toolbarRef = useBottomToolbar()

  const isFeed = pathname === '/'
  const isExplore = pathname.startsWith('/explore')
  const profileHref = userId ? `/user/${userId}` : '/login'
  const bucketHref = userId ? `${profileHref}?tab=bucket` : '/login'
  const isProfile = !!userId && pathname === profileHref
  const isBucket = isProfile && searchParams.get('tab') === 'bucket'
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

        <Link href={profileHref} aria-current={isProfile && !isBucket ? 'page' : undefined} aria-label="Post" className="flex min-w-0 flex-col items-center gap-1 text-[#242e25]">
          <span className="-mt-5 relative inline-flex h-12 w-14 items-center justify-center rounded-md bg-[#355650] shadow-lg [clip-path:polygon(9%_0,91%_0,100%_10%,100%_90%,91%_100%,9%_100%,0_90%,0_10%)]"><span className="flex h-9 w-11 items-center justify-center border-2 border-dashed border-[#355650] bg-[#f1e7d8]"><Image src="/brand/postcard-icon.svg" alt="" width={30} height={30} /></span></span>
          <span className="text-center text-[10px] uppercase leading-tight font-semibold tracking-[0.12em] min-[393px]:text-xs">Post</span>
        </Link>

        <Link href={bucketHref} aria-current={isBucket ? 'page' : undefined} aria-label="Bucket list" className={cls(isBucket)}>
          <span className={iconClass(false)}><Map className="w-6 h-6" /></span>
          <span className="text-center text-[9px] min-[375px]:text-[10px] font-medium uppercase tracking-[0.08em]">Bucket list</span>
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

export default function BottomNav({ userId }: { pendingCount: number; userId: string | null }) {
  return (
    <Suspense fallback={null}>
      <BottomNavInner userId={userId} />
    </Suspense>
  )
}
