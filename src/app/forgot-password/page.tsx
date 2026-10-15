'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/actions/passwordReset'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="type-display">Forgot password?</h1>
          <p className="text-sm text-brown mt-1">Enter your email and we’ll send you a link to choose a new one.</p>
        </div>
        <div className="panel p-6">
          {state?.sent ? (
            <div role="status" className="space-y-3 text-sm">
              <p className="font-medium text-ink">Check your email</p>
              <p className="text-muted">If there’s a Postcard account for that email, a reset link is on its way. It works for the next hour. Can’t find it? Look in your spam folder.</p>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              {state?.message && (
                <p role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">{state.message}</p>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink-soft mb-1">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" required className="field" placeholder="you@example.com" />
              </div>
              <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? 'Sending…' : 'Send reset link'}</button>
            </form>
          )}
        </div>
        <p className="text-center text-sm text-brown mt-6">
          <Link href="/login" className="text-ink-soft font-medium hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
