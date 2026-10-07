'use client'

import { useState, useTransition } from 'react'
import { sendFollowRequest, unfollowUser } from '@/actions/friends'

// "Follow back" for someone who follows you; becomes "Following" (tap again to unfollow).
export default function FollowBackButton({ userId, name, initialFollowing }: { userId: string; name: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} aria-pressed={following} aria-label={`${following ? 'Unfollow' : 'Follow back'} ${name}`} onClick={() => startTransition(async () => {
    if (following) await unfollowUser(userId); else await sendFollowRequest(userId)
    setFollowing(!following)
  })} className="chip shrink-0">{following ? 'Following' : 'Follow back'}</button>
}
