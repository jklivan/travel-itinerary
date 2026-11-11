'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { oauthReturn, saveTripId } from '@/lib/saveTripReturn'
import { register } from '@/actions/auth'
import Link from 'next/link'
import PasswordField from '@/components/ui/PasswordField'
import SocialSignIn from '@/components/SocialSignIn'

function RegisterForm() {
  const searchParams = useSearchParams()
  const tripId = saveTripId(searchParams.get('saveTrip'))
  // Signing up to connect an AI assistant: back to its "Allow" page afterwards.
  const next = oauthReturn(searchParams.get('next'))
  const [state, action, pending] = useActionState(register, undefined)

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="type-display">Create an account</h1>
          <p className="text-sm text-brown mt-1">{next ? 'Create your Postcard account to connect your AI assistant.' : 'Join Postcard. Good places ahead.'}</p>
        </div>

        <div className="panel p-6">
          <SocialSignIn tripId={tripId} next={next} />
          <form action={action} className="space-y-4">
            <input type="hidden" name="saveTrip" value={tripId} />
            {next && <input type="hidden" name="next" value={next} />}
            {state?.message && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
                {state.message}
              </p>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink-soft mb-1">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="field"
                placeholder="Jane Smith"
              />
              {state?.errors?.name && (
                <p className="text-xs text-danger mt-1">{state.errors.name[0]}</p>
              )}
            </div>

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
              {state?.errors?.email && (
                <p className="text-xs text-danger mt-1">{state.errors.email[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-soft mb-1">
                Password
              </label>
              <PasswordField
                id="password"
                name="password"
                autoComplete="new-password"
                required
                placeholder="Min. 8 characters"
              />
              {state?.errors?.password && (
                <p className="text-xs text-danger mt-1">{state.errors.password[0]}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary w-full"
            >
              {pending ? 'Creating account…' : 'Create account'}
            </button>
            <p className="text-center text-xs text-brown">By creating an account you agree to our <Link href="/terms" className="underline">Terms of Use</Link> (no objectionable content or abusive behavior) and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
          </form>
        </div>

        <p className="text-center text-sm text-brown mt-6">
          Already have an account?{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : tripId ? `/login?saveTrip=${encodeURIComponent(tripId)}` : "/login"} className="text-ink-soft font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}
