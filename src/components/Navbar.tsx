import Link from 'next/link'
import PostcardBrand from './PostcardBrand'
import { auth } from '@/auth'
import HeaderMessagesLink from './HeaderMessagesLink'
import HeaderPostButton from './HeaderPostButton'
import { User } from 'lucide-react'

export default async function Navbar() {
  const session = await auth()

  return (
    <header className="app-header postcard-header bg-[#f7f3ec] text-[#1f3354] sticky top-0 z-40">
      {/* Signed in: + (post) · centered logo · messages and profile. Signed out: logo left, sign-in right. */}
      <div className={`max-w-5xl mx-auto px-4 py-3 items-center gap-2 ${session?.user ? 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'flex flex-wrap justify-between gap-3'}`}>
        {session?.user && <div className="flex justify-start"><HeaderPostButton /></div>}
        <Link href="/" aria-label="Postcard home" className="shrink-0">
          <PostcardBrand />
        </Link>

        <div className="flex items-center justify-end gap-0.5 shrink-0">
          {session?.user ? (
            <>
              <HeaderMessagesLink />
              <Link href="/settings"
                className="text-xs text-[#1f3354]/80 hover:text-[#1f3354] px-3 py-1.5 rounded-lg transition-colors hidden sm:block">
                Settings
              </Link>
              <Link href="/profile" aria-label="Profile"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#1f3354] hover:bg-[#1f3354]/10 transition-colors sm:size-11">
                <User size={22} />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login"
                className="text-xs text-[#1f3354]/80 hover:text-[#1f3354] transition-colors">
                Sign in
              </Link>
              <Link href="/register"
                className="text-xs bg-[#1f3354] text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-[#2b4368] transition-colors">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
