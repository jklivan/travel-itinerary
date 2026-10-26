import Link from 'next/link'
import PostcardBrand from './PostcardBrand'
import { auth } from '@/auth'
import HeaderMessagesLink from './HeaderMessagesLink'
import HeaderProfileLink from './HeaderProfileLink'
import HeaderLeft from './HeaderLeft'

export default async function Navbar() {
  const session = await auth()

  return (
    <header className="app-header postcard-header bg-paper text-ink sticky top-0 z-40">
      {/* Signed in: + on Feed, Back elsewhere · centered logo · messages and profile. Signed out: just the logo, centered
          (the sign-in and welcome pages are where people sign in, and Post, Plan and My Trips lead there). */}
      {session?.user ? <div className="max-w-5xl mx-auto grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-3">
        <div className="flex justify-start"><HeaderLeft /></div>
        <Link href="/" aria-label="Postcard home" className="shrink-0">
          <PostcardBrand />
        </Link>
        <div className="flex items-center justify-end gap-0.5 shrink-0">
          <HeaderMessagesLink />
          <Link href="/settings"
            className="text-xs text-ink/80 hover:text-ink px-3 py-1.5 rounded-lg transition-colors hidden sm:block">
            Settings
          </Link>
          <HeaderProfileLink />
        </div>
      </div> : <div className="max-w-5xl mx-auto flex justify-center px-4 py-3">
        <Link href="/" aria-label="Postcard home" className="shrink-0">
          <PostcardBrand />
        </Link>
      </div>}
    </header>
  )
}
