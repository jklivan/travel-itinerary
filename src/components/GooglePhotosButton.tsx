'use client'

import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Images } from 'lucide-react'
import { googleWebClientId } from '@/actions/googleClient'
import { GOOGLE_IOS_CLIENT_ID } from '@/lib/nativeSignInIds'

const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void }
type Gis = { accounts: { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: (response: { access_token?: string; error?: string }) => void }) => TokenClient } } }

// Add trip photos from Google Photos (lib/googlePhotos): allow access once, pick in Google's own screen, and the photos
// land in the trip's photo pile. On the website Google's sign-in window asks; in the iPhone app, its Google sign-in does.
export default function GooglePhotosButton({ tripId, onAdded, disabled = false }: { tripId: string; onAdded: (urls: string[]) => void; disabled?: boolean }) {
  const [step, setStep] = useState<'idle' | 'allowing' | 'ready' | 'picking' | 'copying'>('idle')
  const [error, setError] = useState('')
  const token = useRef('')
  const session = useRef<{ id: string; pickerUri: string; pollMs: number } | null>(null)
  const tokenClient = useRef<TokenClient | null>(null)
  const native = Capacitor.isNativePlatform()

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/google-photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token.current, ...body }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Something went wrong.')
    return data
  }
  async function start(accessToken: string) {
    token.current = accessToken
    try { session.current = await post({ step: 'start' }); setStep('ready') }
    catch (caught) { setStep('idle'); setError(caught instanceof Error ? caught.message : 'Something went wrong.') }
  }
  // The website: Google's script and client ready ahead of the tap, so its window opens straight from it.
  useEffect(() => {
    if (native) return
    let live = true
    void googleWebClientId().then(clientId => {
      if (!clientId || !live) return
      const ready = () => { const google = (window as unknown as { google?: Gis }).google; if (google && live) tokenClient.current = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: response => { if (response.access_token) void start(response.access_token); else { setStep('idle'); setError('Google Photos wasn’t allowed.') } } }) }
      if ((window as unknown as { google?: Gis }).google) { ready(); return }
      const script = Object.assign(document.createElement('script'), { src: 'https://accounts.google.com/gsi/client', async: true })
      script.onload = ready
      document.head.append(script)
    })
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native])

  async function allow() {
    setError(''); setStep('allowing')
    if (!native) { if (tokenClient.current) tokenClient.current.requestAccessToken({ prompt: '' }); else { setStep('idle'); setError('Google Photos isn’t available right now.') }; return }
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      await SocialLogin.initialize({ google: { iOSClientId: GOOGLE_IOS_CLIENT_ID } })
      const response = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile', SCOPE] } })
      const accessToken = (response.result as { accessToken?: { token?: string } | null }).accessToken?.token
      if (accessToken) await start(accessToken); else { setStep('idle'); setError('Google Photos wasn’t allowed.') }
    } catch { setStep('idle'); setError('Google Photos wasn’t allowed.') }
  }
  // Opens Google's picker (a tap of its own, so it isn't blocked), then waits for Done and copies the photos in.
  async function pick() {
    const current = session.current
    if (!current) return
    window.open(native ? current.pickerUri : `${current.pickerUri}/autoclose`, '_blank')
    setStep('picking')
    const until = Date.now() + 20 * 60_000
    while (Date.now() < until) {
      await new Promise(resolve => setTimeout(resolve, current.pollMs))
      if (session.current !== current) return
      try { if ((await post({ step: 'poll', session: current.id })).done) break } catch { /* keep waiting */ }
    }
    if (session.current !== current) return
    setStep('copying')
    try {
      const { urls, skipped } = await post({ step: 'import', session: current.id, tripId }) as { urls: string[]; skipped: number }
      onAdded(urls)
      if (skipped) setError(`${skipped} photo${skipped === 1 ? '' : 's'} couldn’t be copied.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Something went wrong.') }
    session.current = null; setStep('idle')
  }
  const cancel = () => { session.current = null; setStep('idle') }

  return <>
    {step === 'idle' || step === 'allowing'
      ? <button type="button" disabled={disabled || step === 'allowing'} onClick={() => void allow()} className="btn btn-outline btn-sm"><Images size={16} />{step === 'allowing' ? 'Asking Google…' : 'Google Photos'}</button>
      : step === 'ready' ? <button type="button" onClick={() => void pick()} className="btn btn-primary btn-sm"><Images size={16} />Choose in Google Photos</button>
      : <span className="flex flex-wrap items-center gap-2 text-sm text-link"><span className="text-shimmer">{step === 'picking' ? 'Pick your photos in Google Photos, then tap Done…' : 'Copying your photos…'}</span>{step === 'picking' && <button type="button" onClick={cancel} className="text-xs font-semibold text-link underline">Cancel</button>}</span>}
    {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
  </>
}
