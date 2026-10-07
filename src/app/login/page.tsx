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
          <h1 className="type-display">Welcome back</h1>
          <p className="text-sm text-brown mt-1">{tripId ? 'Sign in to save this trip. We’ll bring you back so you can add it to your saved trips.' : 'Sign in to Postcard. Your places are waiting.'}</p>
        </div>

        <div className="bg-cream rounded-2xl border border-sand p-6">
          <form action={action} className="space-y-4">
            <input type="hidden" name="saveTrip" value={tripId} />
            {registered && (
              <p className="text-sm text-link bg-mist border border-mist-line rounded-lg px-4 py-3">
                Account created! Sign in to get started.
              </p>
            )}
            {state?.message && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
                {state.message}
              </p>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-soft mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="field"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-soft mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="field"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary w-full"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-brown mt-6">
          Don&apos;t have an account?{' '}
          <Link href={tripId ? `/register?saveTrip=${encodeURIComponent(tripId)}` : "/register"} className="text-ink-soft font-medium hover:underline">
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
