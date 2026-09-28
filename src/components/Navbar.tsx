import Link from 'next/link'
import PostcardBrand from './PostcardBrand'
import { auth } from '@/auth'
import HeaderMessagesLink from './HeaderMessagesLink'
import HeaderPostButton from './HeaderPostButton'
import { User } from 'lucide-react'

export default async function Navbar() {
  const session = await auth()

  return (
    <header className="app-header postcard-header bg-[#242e25] text-white shadow-md sticky top-0 z-40">
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
                className="text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors hidden sm:block">
                Settings
              </Link>
              <Link href="/profile" aria-label="Profile"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors sm:size-11">
                <User size={22} />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login"
                className="text-xs text-white/70 hover:text-white transition-colors">
                Sign in
              </Link>
              <Link href="/register"
                className="text-xs bg-[#dfd3c2] text-[#242e25] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#c1ad93] transition-colors">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
