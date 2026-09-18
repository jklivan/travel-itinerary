import Link from 'next/link'
import PostcardBrand from './PostcardBrand'
import { auth, signOut } from '@/auth'
import NotificationBell from './NotificationBell'
import { unregisterPushDevice } from '@/actions/notifications'
import { LogOut, User } from 'lucide-react'

export default async function Navbar() {
  const session = await auth()

  return (
    <header className="app-header postcard-header bg-[#242e25] text-white shadow-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label="Postcard home" className="shrink-0">
          <PostcardBrand />
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {session?.user ? (
            <>
              <NotificationBell />
              <span className="text-sm text-white/80 hidden sm:block font-medium truncate max-w-[100px]">
                {session.user.name}
              </span>
              <Link href="/settings"
                className="text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors hidden sm:block">
                Settings
              </Link>
              <form action={async () => {
                'use server'
                await unregisterPushDevice()
                await signOut({ redirectTo: '/' })
              }}>
                <button type="submit" aria-label="Sign out"
                  className="flex size-11 items-center justify-center text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 sm:w-auto sm:px-3 rounded-lg transition-colors">
                  <LogOut size={18} className="sm:hidden" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </form>
              <Link href={session.user.id ? `/user/${session.user.id}` : '/login'} aria-label="Profile"
                className="hidden sm:flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
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
