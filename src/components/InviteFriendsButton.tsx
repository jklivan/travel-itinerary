'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'

export const APP_STORE_URL = 'https://apps.apple.com/us/app/postcard-travel/id6800008568'
const INVITE = `Join me on Postcard, where friends share the places worth going and plan trips together. Get the iPhone app: ${APP_STORE_URL} (or use it on the web at postcardtravel.app)`

// Friends → Invite friends: the phone's share sheet (Messages, WhatsApp…) with an invite and the App Store link.
// Without a share sheet (a computer), a new text message with it; if that can't open either, the invite is copied.
export default function InviteFriendsButton() {
  const [note, setNote] = useState('')
  async function invite() {
    setNote('')
    if (navigator.share) { await navigator.share({ text: INVITE }).catch(() => {}); return }
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) { window.location.href = `sms:&body=${encodeURIComponent(INVITE)}`; return }
    try { await navigator.clipboard.writeText(INVITE); setNote('Invite copied. Paste it into a text or email.') } catch { setNote(INVITE) }
  }
  return <div>
    <button type="button" onClick={() => void invite()} className="btn btn-primary w-full"><UserPlus size={18} />Invite friends</button>
    {note && <p role="status" className="mt-2 break-words text-sm text-muted">{note}</p>}
  </div>
}
