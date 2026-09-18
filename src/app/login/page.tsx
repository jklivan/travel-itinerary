'use client'

import { useActionState } from 'react'
import { login } from '@/actions/auth'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { saveTripId } from '@/lib/saveTripReturn'

function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered')
  const tripId = saveTripId(searchParams.get('saveTrip'))

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-[#242e25]">Welcome back</h1>
          <p className="text-sm text-[#8B6F4E] mt-1">{tripId ? 'Sign in to save this trip. We’ll bring you back so you can add it to your saved trips.' : 'Sign in to Postcard. Your places are waiting.'}</p>
        </div>

        <div className="bg-[#faf7f1] rounded-2xl border border-[#dfd3c2] p-6">
          <form action={action} className="space-y-4">
            <input type="hidden" name="saveTrip" value={tripId} />
            {registered && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                Account created! Sign in to get started.
              </p>
            )}
            {state?.message && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {state.message}
              </p>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#485340] mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-[#c1ad93] px-4 py-2.5 text-sm text-[#242e25] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B6F4E] focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#485340] mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-[#c1ad93] px-4 py-2.5 text-sm text-[#242e25] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B6F4E] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-[#242e25] text-white font-medium py-2.5 rounded-lg hover:bg-[#485340] transition-colors disabled:opacity-60"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#8B6F4E] mt-6">
          Don&apos;t have an account?{' '}
          <Link href={tripId ? `/register?saveTrip=${encodeURIComponent(tripId)}` : "/register"} className="text-[#485340] font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
