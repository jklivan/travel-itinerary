'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { socialSignIn } from '@/actions/auth'

const buttons = [
  { id: 'apple', label: 'Continue with Apple', className: 'btn btn-primary w-full' },
  { id: 'google', label: 'Continue with Google', className: 'btn btn-outline w-full' },
]

// Only the providers that are set up. Hidden in the iPhone app, where Google blocks sign-in inside the app's web view.
export default function SocialSignIn({ tripId }: { tripId: string }) {
  const [available, setAvailable] = useState<string[]>([])
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    fetch('/api/auth/providers').then(response => response.json()).then((providers: Record<string, unknown>) => setAvailable(Object.keys(providers))).catch(() => {})
  }, [])
  const shown = buttons.filter(button => available.includes(button.id))
  if (!shown.length) return null
  return <div className="mb-5 space-y-2">
    {shown.map(button => <form key={button.id} action={socialSignIn}>
      <input type="hidden" name="provider" value={button.id} />
      <input type="hidden" name="saveTrip" value={tripId} />
      <button type="submit" className={button.className}>{button.label}</button>
    </form>)}
    <p className="flex items-center gap-3 pt-2 text-xs text-brown before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or with email</p>
  </div>
}
