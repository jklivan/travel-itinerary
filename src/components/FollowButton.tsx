'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelFollowRequest, sendFollowRequest, unfollowUser } from '@/actions/friends'

type Status = 'accepted' | 'pending' | null

// Follow / Following, everywhere people are listed. It changes the moment it's tapped (saving the follow and sending
// the alert takes a second or two, which read as a tap that hadn't worked) and changes back if the save fails.
// refresh: reload the page's data afterwards (follower counts on a profile).
export default function FollowButton({ userId, name, initialStatus, followsYou = false, refresh = false, onChange }: {
  userId: string; name: string; initialStatus: Status | boolean; followsYou?: boolean; refresh?: boolean; onChange?: (following: boolean) => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>(initialStatus === true ? 'accepted' : initialStatus === false ? null : initialStatus)
  const [saving, setSaving] = useState(false)
  async function toggle() {
    if (saving) return
    const before = status
    const next: Status = before ? null : 'accepted'
    setStatus(next); setSaving(true); onChange?.(!!next)
    try {
      if (before === 'accepted') await unfollowUser(userId)
      else if (before === 'pending') await cancelFollowRequest(userId)
      else await sendFollowRequest(userId)
      if (refresh) router.refresh()
    } catch { setStatus(before); onChange?.(!!before) } finally { setSaving(false) }
  }
  const label = status === 'accepted' ? 'Following' : status === 'pending' ? 'Requested' : followsYou ? 'Follow back' : '+ Follow'
  return <button type="button" onClick={() => void toggle()} aria-pressed={status === 'accepted'} aria-label={`${status ? 'Unfollow' : 'Follow'} ${name}`} className="chip shrink-0">{label}</button>
}
