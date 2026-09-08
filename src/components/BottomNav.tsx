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
    return `flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${active ? 'text-[#2C1810]' : 'text-[#8B6F4E] hover:text-[#5C3D2E]'}`
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
    <div className="fixed bottom-0 left-0 right-0 bg-[#FAF7F2] border-t border-[#E8D5B7] shadow-lg z-50">
      {/* Create popup */}
      {showCreate && (
        <div ref={popupRef} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-[#FAF7F2] rounded-2xl shadow-xl border border-[#E8D5B7] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8D5B7]">
            <span className="text-sm font-semibold text-[#2C1810]">Create a trip</span>
            <button onClick={() => setShowCreate(false)} className="text-[#8B6F4E] hover:text-[#5C3D2E]">
              <X size={16} />
            </button>
          </div>
          <Link
            href="/create"
            onClick={() => setShowCreate(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#E8D5B7] transition-colors border-b border-[#E8D5B7]"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E8D5B7] flex items-center justify-center shrink-0">
              <FileText size={18} className="text-[#2C1810]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#2C1810]">Import a trip</p>
              <p className="text-xs text-[#8B6F4E] mt-0.5">Upload a file or paste notes</p>
            </div>
          </Link>
          <Link
            href="/create/guided"
            onClick={() => setShowCreate(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#E8D5B7] transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-[#DDE8D5] flex items-center justify-center shrink-0">
              <LayoutList size={18} className="text-[#4E6B4E]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#2C1810]">Build a trip</p>
              <p className="text-xs text-[#8B6F4E] mt-0.5">Add places yourself</p>
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
              ? 'bg-[#5C3D2E] text-white'
              : 'bg-[#2C1810] text-white hover:shadow-xl'
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
