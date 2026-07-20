'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, Compass, Plus, Users, User } from 'lucide-react'
import { Suspense } from 'react'

function BottomNavInner({ userId, pendingCount }: { userId: string | null; pendingCount: number }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')

  const isFeed = pathname === '/' && view !== 'explore'
  const isExplore = pathname === '/' && view === 'explore'
  const isFriends = pathname.startsWith('/friends')
  const isProfile = pathname.startsWith('/user/')

  function cls(active: boolean) {
    return `flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-2xl mx-auto flex justify-around items-center py-2">
        <Link href="/" className={cls(isFeed)}>
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">Feed</span>
        </Link>

        <Link href="/?view=explore" className={cls(isExplore)}>
          <Compass className="w-6 h-6" />
          <span className="text-xs font-medium">Explore</span>
        </Link>

        <Link
          href="/create"
          className="flex flex-col items-center gap-0.5 px-4 py-2 -mt-5 bg-gradient-to-r from-blue-600 to-yellow-400 text-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
        >
          <Plus className="w-7 h-7" />
        </Link>

        <Link href="/friends" className={`relative ${cls(isFriends)}`}>
          <Users className="w-6 h-6" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
          <span className="text-xs font-medium">Friends</span>
        </Link>

        <Link href={userId ? `/user/${userId}` : '/login'} className={cls(isProfile)}>
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Profile</span>
        </Link>
      </div>
    </div>
  )
}

export default function BottomNav({ userId, pendingCount }: { userId: string | null; pendingCount: number }) {
  return (
    <Suspense fallback={null}>
      <BottomNavInner userId={userId} pendingCount={pendingCount} />
    </Suspense>
  )
}
