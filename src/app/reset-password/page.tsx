'use client'

import { Suspense, useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { resetPassword } from '@/actions/passwordReset'

function ResetForm() {
  const token = useSearchParams().get('token') ?? ''
  const [state, action, pending] = useActionState(resetPassword, undefined)
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="type-display">Choose a new password</h1>
          <p className="text-sm text-brown mt-1">At least 8 characters.</p>
        </div>
        <div className="panel p-6">
          {!token ? (
            <p className="text-sm text-muted">This link is incomplete. <Link href="/forgot-password" className="text-link hover:underline">Ask for a new one</Link>.</p>
          ) : (
            <form action={action} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              {state?.message && (
                <p role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
                  {state.message}{/expired|already used/.test(state.message) && <> <Link href="/login" className="underline">Sign in</Link> · <Link href="/forgot-password" className="underline">Send a new link</Link></>}
                </p>
              )}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink-soft mb-1">New password</label>
                <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-ink-soft mb-1">Type it again</label>
                <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="field" />
              </div>
              <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? 'Saving…' : 'Save new password'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>
}
