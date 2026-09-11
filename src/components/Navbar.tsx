import Link from 'next/link'
import { auth, signOut } from '@/auth'
import NavSearch from './NavSearch'
import NotificationBell from './NotificationBell'
import { unregisterPushDevice } from '@/actions/notifications'

export default async function Navbar() {
  const session = await auth()

  return (
    <header className="bg-[#2C1810] text-white shadow-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="shrink-0">
          <h1 className="text-xl font-bold text-white leading-tight font-[family-name:var(--font-playfair)]">Xen</h1>
          <p className="text-[#C4A882] text-xs leading-none hidden sm:block">Share your journey</p>
        </Link>

        <div className="order-last w-full md:order-none md:w-auto md:flex-1 md:max-w-xs">
          <NavSearch />
        </div>

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
                <button type="submit"
                  className="text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login"
                className="text-xs text-white/70 hover:text-white transition-colors">
                Sign in
              </Link>
              <Link href="/register"
                className="text-xs bg-[#E8D5B7] text-[#2C1810] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#C4A882] transition-colors">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
