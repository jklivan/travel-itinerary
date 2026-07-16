import Link from 'next/link'
import { auth, signOut } from '@/auth'
import NavSearch from './NavSearch'

export default async function Navbar() {
  const session = await auth()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-indigo-600 tracking-tight">
          TravelShare
        </Link>
        <div className="flex items-center gap-4">
          <NavSearch />
          {session?.user ? (
            <>
              <span className="text-sm text-gray-600 hidden sm:block">
                {session.user.name}
              </span>
              <Link href="/friends" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors hidden sm:block">
                Friends
              </Link>
              <Link
                href="/create"
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + Post Itinerary
              </Link>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/' })
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link
                href="/register"
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
