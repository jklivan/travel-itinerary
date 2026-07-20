import Link from 'next/link'
import { auth, signOut } from '@/auth'
import NavSearch from './NavSearch'

export default async function Navbar() {
  const session = await auth()

  return (
    <header className="bg-gradient-to-r from-blue-600 to-yellow-400 text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="shrink-0">
          <h1 className="text-xl font-bold text-white leading-tight">Travel!</h1>
          <p className="text-blue-50 text-xs leading-none hidden sm:block">Share your journey</p>
        </Link>

        <div className="flex-1 max-w-xs">
          <NavSearch />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {session?.user ? (
            <>
              <span className="text-sm text-white/90 hidden sm:block font-medium truncate max-w-[100px]">
                {session.user.name}
              </span>
              <form action={async () => {
                'use server'
                await signOut({ redirectTo: '/' })
              }}>
                <button type="submit"
                  className="text-xs text-white/80 hover:text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login"
                className="text-xs text-white/80 hover:text-white transition-colors">
                Sign in
              </Link>
              <Link href="/register"
                className="text-xs bg-white text-blue-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
