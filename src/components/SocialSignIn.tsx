'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { nativeSignIn, socialSignIn } from '@/actions/auth'
import { GOOGLE_IOS_CLIENT_ID } from '@/lib/nativeSignInIds'

const buttons = [
  { id: 'apple', label: 'Continue with Apple', className: 'btn btn-primary w-full' },
  { id: 'google', label: 'Continue with Google', className: 'btn btn-outline w-full' },
] as const

// Sign in with Apple and Google. On the website: the providers that are set up, through their own sign-in pages. In
// the iPhone app: both, signed in natively (Google blocks its web sign-in inside apps); app builds from before the
// sign-in plugin show neither.
// next: an AI assistant's "Allow" page to come back to (connecting it), if any.
export default function SocialSignIn({ tripId, next = '' }: { tripId: string; next?: string }) {
  const [available, setAvailable] = useState<string[]>([])
  const [native, setNative] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.isPluginAvailable('SocialLogin')) { setNative(true); setAvailable(['apple', 'google']) }
      return
    }
    fetch('/api/auth/providers').then(response => response.json()).then((providers: Record<string, unknown>) => setAvailable(Object.keys(providers))).catch(() => {})
  }, [])

  async function signInNatively(provider: 'apple' | 'google') {
    setBusy(provider); setError('')
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      await SocialLogin.initialize({ google: { iOSClientId: GOOGLE_IOS_CLIENT_ID }, apple: {} })
      const response = provider === 'google'
        ? await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } })
        : await SocialLogin.login({ provider: 'apple', options: { scopes: ['name', 'email'] } })
      const result = response.result as { idToken?: string | null; profile?: { givenName?: string | null; familyName?: string | null; name?: string | null } }
      if (!result.idToken) { setError('That sign-in didn’t go through. Try again, or sign in with your email.'); return }
      // Apple only gives the name the first time someone signs in to the app.
      const name = result.profile?.name || [result.profile?.givenName, result.profile?.familyName].filter(Boolean).join(' ')
      const outcome = await nativeSignIn(provider, result.idToken, name, tripId, next)
      if (outcome?.error) setError(outcome.error)
    } catch (caught) {
      // Closing the Apple or Google sheet isn't an error worth showing.
      if (!/cancel/i.test(caught instanceof Error ? caught.message : String(caught))) setError('That sign-in didn’t go through. Try again, or sign in with your email.')
    } finally { setBusy('') }
  }

  const shown = buttons.filter(button => available.includes(button.id))
  if (!shown.length) return null
  return <div className="mb-5 space-y-2">
    {shown.map(button => native
      ? <button key={button.id} type="button" disabled={!!busy} onClick={() => void signInNatively(button.id)} className={button.className}>{busy === button.id ? 'Signing in…' : button.label}</button>
      : <form key={button.id} action={socialSignIn}>
        <input type="hidden" name="provider" value={button.id} />
        <input type="hidden" name="saveTrip" value={tripId} />
        {next && <input type="hidden" name="next" value={next} />}
        <button type="submit" className={button.className}>{button.label}</button>
      </form>)}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <p className="flex items-center gap-3 pt-2 text-xs text-brown before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or with email</p>
  </div>
}
