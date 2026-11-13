'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, HeartPulse } from 'lucide-react'
import { consentToRemember } from '@/actions/travelerMemory'

// The planner was asked to remember a health detail (an allergy, a mobility need…): it's only kept once they agree
// here, and when is recorded (lib/travelerMemory). Washington's My Health My Data Act asks for this separate,
// informed consent; /privacy/health-data explains it.
export default function RememberConsent({ items }: { items: string[] }) {
  return <div className="space-y-2">{items.map(item => <ConsentCard key={item} item={item} />)}</div>
}

function ConsentCard({ item }: { item: string }) {
  const [state, setState] = useState<'asking' | 'saving' | 'saved' | 'declined'>('asking')
  const [error, setError] = useState('')
  if (state === 'saved') return <p role="status" className="flex items-center gap-1.5 text-sm text-ink"><Check size={16} className="text-link" />Saved. Remove it any time in <Link href="/settings" className="font-semibold text-link underline underline-offset-2">Settings</Link>.</p>
  if (state === 'declined') return <p className="text-sm text-muted">Not saved. Mention it again whenever it matters.</p>
  return <div className="panel-hint p-3 text-sm text-ink">
    <p className="flex items-start gap-1.5 font-semibold"><HeartPulse size={16} className="mt-0.5 shrink-0 text-link" />Save “{item}” so the planner remembers it?</p>
    <p className="mt-1 text-muted">This is health information. If you save it, Postcard keeps it on your account and uses it to plan your trips, sending it to Anthropic (our AI provider) when you chat with the planner. It isn’t shared with anyone else or used for ads. You can delete it any time in Settings. <Link href="/privacy/health-data" className="underline">Consumer Health Data Privacy Policy</Link></p>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={state === 'saving'} onClick={async () => {
        setState('saving'); setError('')
        const result = await consentToRemember(item).catch(() => ({ error: 'Could not save. Please try again.' }))
        if ('error' in result && result.error) { setError(result.error); setState('asking') } else setState('saved')
      }} className="btn btn-primary btn-sm">{state === 'saving' ? 'Saving…' : 'Save'}</button>
      <button type="button" disabled={state === 'saving'} onClick={() => setState('declined')} className="btn btn-outline btn-sm">Not now</button>
    </div>
    {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
  </div>
}
