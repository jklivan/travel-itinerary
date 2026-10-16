'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { signOutNow } from '@/actions/session'

// Signs out, then loads the home page fresh: a soft redirect kept the signed-in pages already on screen, so it
// looked like the first tap hadn't worked.
export default function SignOutButton() {
  const [busy, setBusy] = useState(false)
  return <button type="button" disabled={busy} onClick={async () => {
    setBusy(true)
    try { await signOutNow() } finally { window.location.assign('/') }
  }} className="btn btn-outline w-full"><LogOut size={18} />{busy ? 'Signing out…' : 'Sign out'}</button>
}
