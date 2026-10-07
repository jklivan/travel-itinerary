import Link from 'next/link'
import PostcardBrand from './PostcardBrand'
import { auth } from '@/auth'
import HeaderMessagesLink from './HeaderMessagesLink'
import HeaderLeft from './HeaderLeft'
import { User } from 'lucide-react'

export default async function Navbar() {
  const session = await auth()

  return (
    <header className="app-header postcard-header bg-paper text-ink sticky top-0 z-40">
      {/* Signed in: + on Feed, Back elsewhere · centered logo · messages and profile. Signed out: logo left, sign-in right. */}
      <div className={`max-w-5xl mx-auto px-4 py-3 items-center gap-2 ${session?.user ? 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'flex flex-wrap justify-between gap-3'}`}>
        {session?.user && <div className="flex justify-start"><HeaderLeft /></div>}
        <Link href="/" aria-label="Postcard home" className="shrink-0">
          <PostcardBrand />
        </Link>

        <div className="flex items-center justify-end gap-0.5 shrink-0">
          {session?.user ? (
            <>
              <HeaderMessagesLink />
              <Link href="/settings"
                className="text-xs text-ink/80 hover:text-ink px-3 py-1.5 rounded-lg transition-colors hidden sm:block">
                Settings
              </Link>
              <Link href="/profile" aria-label="Profile"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-ink/10 transition-colors sm:size-11">
                <User size={22} />
              </Link>
            </>
          ) : (
            // Just Sign in: the welcome screen already asks new visitors to sign up.
            <Link href="/login"
              className="text-xs text-ink/80 hover:text-ink transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
