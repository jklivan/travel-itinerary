'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, Plus, Users, User, X, FileText, LayoutList } from 'lucide-react'
import { Suspense, useState, useEffect, useRef } from 'react'

function BottomNavInner({ userId, pendingCount }: { userId: string | null; pendingCount: number }) {
  const pathname = usePathname()
  const [showCreate, setShowCreate] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  const isFeed = pathname === '/'
  const isExplore = pathname.startsWith('/explore')
  const isFriends = pathname.startsWith('/friends')
  const isProfile = pathname.startsWith('/user/')

  function cls(active: boolean) {
    return `flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowCreate(false)
      }
    }
    if (showCreate) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCreate])

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      {/* Create popup */}
      {showCreate && (
        <div ref={popupRef} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Create a trip</span>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <Link
            href="/create"
            onClick={() => setShowCreate(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Full form</p>
              <p className="text-xs text-gray-500 mt-0.5">Add everything at once</p>
            </div>
          </Link>
          <Link
            href="/create/guided"
            onClick={() => setShowCreate(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <LayoutList size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Step by step</p>
              <p className="text-xs text-gray-500 mt-0.5">Card-by-card guided flow</p>
            </div>
          </Link>
        </div>
      )}

      <div className="max-w-2xl mx-auto flex justify-around items-center py-2">
        <Link href="/" className={cls(isFeed)}>
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">Feed</span>
        </Link>

        <Link href="/explore" className={cls(isExplore)}>
          <Compass className="w-6 h-6" />
          <span className="text-xs font-medium">Explore</span>
        </Link>

        <button
          onClick={() => setShowCreate(v => !v)}
          className={`flex flex-col items-center gap-0.5 px-4 py-2 -mt-5 rounded-full shadow-lg transition-all ${
            showCreate
              ? 'bg-gray-800 text-white'
              : 'bg-gradient-to-r from-blue-600 to-yellow-400 text-white hover:shadow-xl'
          }`}
        >
          <Plus className="w-7 h-7" />
        </button>

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
